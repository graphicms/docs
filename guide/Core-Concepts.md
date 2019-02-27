---
sidebarDepth: 3
---
# Core concepts
## GraphQL Package

Because most of the GraphQL schema is dynamically generated, we had to modify some small features from [rebing/graphql-laravel](https://github.com/rebing/graphql-laravel) and that's how [graphicms/graphql](https://github.com/graphicms/graphql) package was born. Most of the behaviour is the same, but we had to make uses of closures in parts of the schema definition to lazily evaluate the types. We also pre-configured the package to meet our package's requirements. You do not have to install it separately or configure it.

The package is auto-discovered by the Laravel `php artisan package:discover` command.

It automatically registers the service provider `Graphicms\GraphQL\GraphQLServiceProvider`  and an alias called `CmsQL` that points to the `Graphicms\GraphQL\GraphQLFacade` facade.

::: tip
Most of the operations you will learn about below are done automatically by the system when you define a new collection in the control panel. In a simple scenario, you don't have to register schemas, types, queries or mutations by code only if you want to re-use them or make an extension for GraphiCMS. Still, it's good to learn about the foundation building blocks because that's what GraphiCMS is using behind the scenes.
:::

## Schemas
You can have multiple GraphQL endpoints by defining schemas. By default there are two endpoints configured by the system: `default` and `backend`. You can register additional schemas using the `CmsQl` class. For example, this is how the package registers the backend scheme that is used by the control panel:

```php
\CmsQL::addNewScheme('backend', [
        'middleware' => ['web', Authenticate::class, OnlyFromBackend::class]
]);
```

You can add any middleware for the schema. For example, you can have one public schema that is read only, but add a new one that requires authentication to read and update it.

You can also provide the queries and mutations at registration type by passing two additional keys: `query` and `mutation`. This behaviour is inherited from the `rebing/laravel-graphql` package. Example:

```php
\CmsQL::addNewScheme('blog', [
        'query' => [
            'example_query' => ExampleQuery::class,
        ],
        'mutation' => [
            'example_mutation'  => ExampleMutation::class,
        ],
]);
```

Using this way to define the GraphQL Schema is fine, but GrahiCMS provides an easier way to register schemas, types and mutations and you'll learn about the "Graphi way" soon.

Schemas are by default accessible using the following route: `/graphi/api/{scheme?}`. If a scheme is not defined, the `default` one will be used. If, for example, you want to query or mutate the `backend` scheme, you access it under `/graphi/api/backend` using POST or GET.

In a nutshell, schemas are a collection of types, mutations and queries. Everything but types are scoped to a schema. Types are defined once and can be used in any schema.

:::tip
### What if I do not want to use Service Providers for registering code?
<a name="graphi-loaders"></a>
GraphiCMS is configured to look into your app folder if there are files named **Graphi/*Loader.php**. If there is one, it will autoload it using the DI Container (which means you can typehint any dependencies that you need and Laravel will inject those.

```php
<?php
// app/Graphi/MyLoader.php
namespace App\Graphi\MyLoader.php;
use Illuminate\Contracts\Foundation\Application;
use Graphicms\GraphQL\Events\ServingGraphQL;

class MyLoader {
    public function __construct(Application $app) {
        $app->make('events')->listen(ServingGraphQL::class, function() {
            // here you would register your custom things.
        })
    }
}
```

You can have as many Loaders as you want, GraphiCMS will load all of them.
:::

## Types

As you might already know, GraphQL is strongly-typed. This means that every field must have a type. This way, you know  that the response from the GraphQL endpoint will have a certain structure.

GraphiCMS defines most of the types for you, based on the collections you define in the control panel. There are cases when you want to define a type in code, for example when building an extension for GraphiCMS and want the schema to be encapsulated in the extension.

### Registering a new type

Registering a new type in GraphiCMS' api is pretty simple using the `CmsQL::addType()` function. There are two main approaches for registering your own types, and we will learn both of them now.

#### 1. Creating a new class and registering [More complicated]

```php
<?php

namespace App\GraphQL\Type;

use App\User;
use GraphQL\Type\Definition\Type;

class UserType extends GraphQLType
{    
    protected $attributes = [
        'name'          => 'User',
        'description'   => 'A user',
        'model'         => User::class,
    ];

    public function fields()
    {
        return [
            'id'                => [
                'type' => Type::int(),
            ],
            'name'              => [
                'type' => Type::string(),
            ],
            'email'             => [
                'type' => Type::string(),
            ],
            'email_verified_at' => [
                'type' => Type::string(),
            ],
            'password'          => [
                'type' => Type::string(),
            ],
            'remember_token'    => [
                'type' => Type::string(),
            ],
            'created_at'        => [
                'type' => Type::int(),
            ],
            'updated_at'        => [
                'type' => Type::int(),
            ]
        ];
    }

    // If you want to resolve the field yourself, you can declare a method
    // with the following format resolve[FIELD_NAME]Field()
    protected function resolveEmailField($root, $args)
    {
        return strtolower($root->email);
    }
}
```
After having the class defined, you need to register it in the system like so:

```php
\CmsQL::addType(App\GraphQL\Type\UserType::class, 'User');
```

#### 2. Creating a "DynamicType" in a Service Provider [GraphiCMS preferred way]

This is how core types are registered internally by the package. By making use of this approach, you do not have to create a new class for every type you need, you just make use of the class we provide in the package `\Graphicms\Cms\GraphQL\DynamicType`. You can use the static `make` function to define a new type. The `DynamicType::make` signature is as it follows:

```php
DynamicType::make(
    array $attributes,
    array $fields,
    array $resolvers = [],
    array $interfaces = []
);
```

As you can see, only `$attributes` and `$fields` are needed to define a new Type.

`$attributes` can be one of the following:

| key | description | required |
| --- | --- | --- |
| name | The name of the new type. | yes |

`$fields` is the array containing the fields for the new type.

```php
[
    'id' => [
        'type' => \GraphQL\Type\Definition\Type::int(),
    ],
    'name' => [
        'type' => \GraphQL\Type\Definition\Type::string(),
    ],
    'created_at' => [
        'type' => \GraphQL\Type\Definition\Type::int(),
    ],
]
```

`$resolvers` is an array with additional resolvers for your fields. You can use resolvers for columns that are not returned in your main array of data or for modifying columns. Resolvers use the convention of naming `resolve{FieldName}Field` where FieldName is your field name in StudlyCase. For example, to modify the format of your created_at field, pass an resolver:

```php
[
    'resolveCreatedAtField' => function($root) {
        if ($root->created_at instanceof \Carbon\Carbon) {
            return $root->created_at->format('U');
        }
        return null;
    }
]
```
Resolvers can also be passed in the field definition, where you define `type` too and never use the resolvers variable:

```php{5-10}
[
    ...
    'created_at' => [
        'type' => \GraphQL\Type\Definition\Type::int(),
        'resolver' => function($root) {
            if ($root->created_at instanceof \Carbon\Carbon) {
                return $root->created_at->format('U');
            }
            return null;
        }
    ],
    ...
]
```

`$interfaces` allow some fields to be re-used amongst other types. Read about GraphQL interfaces [here](https://graphql.org/learn/schema/#interfaces). Interfaces are useful if you re-use the same fields for many types. We provide two core interfaces: `IsSoftDeleting` and `HasDates`. You will need to add those interfaces if you have the dates attributes `created_at` and `updated_at` or your type is being soft deleted and has `deleted_at` column.

```php
[
    \CmsQL::type('HasDates'),
    \CmsQL::type('IsSoftDeleting'),
]
```
<a name="registerTypesEarly"></a>

Adding those interfaces in the $interfaces parameter will automatically add `created_at, updated_at` and `deleted_at` fields and would automatically resolve those fields.

It is better to register types earliest in the app lifecycle for example in the `register` method of a Service Provider.

Full example of registering a new GraphQL type in a Service Provider:

```php
<?php
use Graphicms\Cms\GraphQL\DynamicType;
use Illuminate\Support\ServiceProvider;

class MyServiceProvider extends ServiceProvider {
    public function register() {
        \CmsQL::addType(DynamicType::make([
            'name' => 'User',
        ], [
            'id' => [
                'type' => Type::int(),
            ],
            'name' => [
                'type' => Type::string(),
            ],
            'email' => [
                'type' => Type::string(),
            ]
        ], [], [
            \CmsQL::type('HasDates'),
            \CmsQL::type('IsSoftDeleting'),
        ]);
    }
}
```

Having the code above, you can now reference to the type using the `\CmsQL::type($name)` function.

::: warning
**Beware of not-defined errors with closures** 

As a general rule of thumb, if you reference non-standard types (a user defined type not Int, String or Boolean or any other field from GraphQL standard), it is better to wrap the <code>type</code> value in a closure to avoid concurrency issues. Without a closure, you might reference a type that is not yet defined and receive an exception that 'requested type is not registered`.
:::

Example of avoiding concurrency issues: 

```php{6-8}
\CmsQL::addType(DynamicType::make(
    ['name' => 'User'], [
        'id' => ['type' => Type::int()],
        'name' => ['type' => Type::string()],
        'brothers' => [
            'type' => function() {
               return Type::listOf(\CmsQL::type('User');
            }
        ]
    ]
));
```

If you do not provide a closure for the `brothers` field, you would receive an exception because the type `User` is not yet defined.
> Exception
> Type User not found.

A closure helps the system to lazily evaluate the type of the field only when needed, not when main type is defined.

::: tip
GraphQL comes with a set of default scalar types out of the box that you will use most of the time to compose your own types:
* `Int` A signed 32‐bit integer.
* `Float` A signed double-precision floating-point value.
* `String` A UTF‐8 character sequence.
* `Boolean` A `true` or `false` value
* `Id` The ID scalar type represents a unique identifier, often used to refetch an object or as the key for a cache. The ID type is serialized in the same way as a String; however, defining it as an ID signifies that it is not intended to be human‐readable.
:::

### Enum Type
There's also a special type called Enum that takes a list of allowed values and the client can now in advance what values might come from the api.

```php
<?php
use GraphQL\Type\Definition\EnumType;

$sizeEnum = new EnumType([
    'name' => 'Shoe Size',
    'description' => 'Only those are allowed for user\'s shoe size.',
    'values' => [
        'SMALL'  => ['value' => 'SMALL'], 
        'MEDIUM' => ['value' => 'MEDIUM'], 
        'BIG'    => ['value' => 'BIG']
    ]
]);

\CmsQL::addType(DynamicType::make([
            'name' => 'User',
        ], [
            'id' => [
                'type' => Type::int(),
            ],
            'name' => [
                'type' => Type::string(),
            ],
            'email' => [
                'type' => Type::string(),
            ],
            'shoe_size' => [
                'type' => $sizeEnum,
            ]
        ], [], [
            \CmsQL::type('HasDates'),
            \CmsQL::type('IsSoftDeleting'),
        ]);
```

### Union Type

A union is just a simple collection of types. Imagine you have a query that might search amongst many collections of data. You could search for Users but also Articles. The query responsible for searching could return an SearchResultUnion type with those two possible return types. Then the client that makes the request is responsible to decide what fields they want returned and on what types. Read more about union types [here](https://graphql.org/learn/schema/#union-types).

GraphiCMS uses union types for auto generated read queries. When you request a specific `id` for a collection object, a simple type representing that object (say `UserType`) is returned. But if you request all the users in the system, a `UserCollection` type is returned. This includes pagination data(page, per_page, total items and so on) but also includes `data` that is an array of requested type.

### Type modifiers

Object types, scalars, and enums are the only kinds of types you can define in GraphQL. But when you use the types in other parts of the schema, or in your query variable declarations, you can apply additional type modifiers that affect validation of those values.
* **Non-Null**. Wrap a type in `\GraphQL\Type\Definition\Type::nonNull($actualType)` to mark it as not nullable. This way, when the client is not sending that argument, the query will fail. Also, when you specify a return type as nonNull, you have to always return a value or the query will also fail.
* **Lists/Collections**. When you want to return an array of a certain type, you use `\GraphQL\Type\Definition\Type::listOf($actualType)`. For example a query that returns a list of users you use `\GraphQL\Type\Definition\Type::nonNull(\CmsQL::type('User'))`

### Input types

By default all types that you define are *write-only*. This means that the API can return them but the client cannot send a parameter of those types. When you register a DynamicType and you want that to be input-enabled too, pass the `'input' => true` argument as part of the definition. For example, this is one type registered by GraphiCMS internally:

```php{3}
\CmsQL::addType(DynamicType::make([
            'name' => 'Pagination',
            'input' => true,
        ], [
            'current_page' => [
                'type' => Type::int(),
            ],
            'per_page' => [
                'type' => Type::int(),
            ]
        ]));
```

No you can write queries or mutations that accept an argument of type `Pagination` (if you specify it in the arguments list).

## Queries

Queries are the way you request data from your GraphQL endpoint. Read [here](https://graphql.org/learn/schema/#the-query-and-mutation-types) about the basics of queries. One first notable difference from Types is that **a query belongs to a schema**, whereas types are re-used amongst all schemas. It's also important to note that queries are read-only, they are the equivalent of GET requests in REST.

There are two mandatory parts for a query: returning type and resolver.

<p id="requiredQueriesParts">A query needs to have **returning type** from the basic ones described above or one that you defined. Returning types can also be wrapped in a [modifier](#type-modifiers), so you can return a list of things or specify that the response is never null.</p>

The other thing that is mandatory in a query is the **query resolver**. The resolver is where the data is manipulated and returned as the *query response*.

::: tip
A resolver is for a query what a controller method is for a response in Laravel - a thing that returns data to the one who requested it.
:::

A query can also have **attributes**. Those attributes allow you to manipulate data in resolvers in certain ways. Attributes have a name, a type (original GraphQL scalar types like string or boolean, or user defined types that are marked as `inputType => true`.

GraphiCMS allows you to register a query in an easy way by using the `DynamicQuery` class.

The following is an example that registers a query named `greetMe` that takes an argument too and returns a string:

```php
<?php
use Graphicms\Cms\GraphQL\DynamicQuery;
use GraphQL\Type\Definition\Type;

\CmsQL::addDynamicQuery(DynamicQuery::make([
    'name'     => 'greetMe',
    'type'     => function () {
        return Type::string();
    },
    'resolver' => function ($context, $arguments) {
        return "Hello, {$arguments['name']}!";
    },
    'args' => function() {
        return [
            'name' => [
                'type' => Type::nonNull(Type::string())
            ]
        ];
    }
]));
```

The beauty of using nonNull modifiers is that in a resolver you know that you will always have the required data, so in the example above, you don't have to check if `$arguments` contain a key named `name` or that it's value is not null. When data hits the resolver, it is already validated.

The signature of the addDynamicQuery is:

```php
\CmsQL::addDynamicQuery($instanceOfDynamicQuery, $schema = 'default');
```
If you want to add the query to a specific schema, specify the second parameter. If you want the query to be added on the default schema, leave it as unspecified.

## Mutations

Mutations in GraphQL are the equivalent of POST/PUT requests in REST. A mutation is almost identical to a query, except it is meant to produce side-effects (create something, delete, modify). Although you could (at least) theoretically do this in a query, it's against the spec of GraphQL.

Mutations, like queries, need at least two things:
1. A returning type
2. A resolver

You can look in the [query section](#requiredQueriesParts) to see what is the resolver and why a returning type is required, with the notable exception that in a mutation's resolver you can write data to the db/storage too.

A mutation can have **validation rules** too. You can use   all the rules from Laravel validation and before hitting the resolver, the system will validate the arguments. If invalid, the errors will be returned to the user/requester and the resolver will never be called.

A mutation can be registered in a similar fashion like a query, by using `\CmsQL::addDynamicMutation($mutation, $schema = 'default')`. You can use the class provided in the package called `\Graphicms\Cms\GraphQL\DynamicMutation` to register a new mutation. The only different thing is that you can specify a set of **validation rules** for a DynamicMutation.

Imagine a mutation that allows a user to change its email address. You can register it like this:

```php
<?php
use \Graphicms\Cms\GraphQL\DynamicMutation;
use \GraphQL\Type\Definition\Type;

\CmsQL::addDynamicMutation(DynamicMutation::make([
            'name'     => 'changeEmail',
            'type'     => function () {
                return Type::boolean();
            },
            'resolver' => function ($scope, $args) {
                $user = auth()->user();
                $user->email = $args['email'];
                $user->save();

                return true;
            },
            'args'     => function () {
                return [
                    'newEmail' => [
                        'type' => Type::nonNull(Type::string()),
                    ],
                ];
            },
            'rules'    => function () {
                return [
                    'email' => ['required', 'email', Rule::unique('users')->ignore(auth()->user()->id)]
                ];
            }
        ]));
```

By defining rules for the above mutation you can rest assured that the input data is validated before hitting the resolver and you can use standard validation rules too.

::: warning
#### When to define Types, Queries or Mutations
When defining Types, it is recommended (as specified [above](#registerTypesEarly) too) to register them early in the app lifecycle.

However, queries and mutations should be defined only when the api is accessed. This way we gain performance, because the queries are not generated for every request, but also we can be sure that all types we need for queries are generated. To make this process easy, GraphiCMS dispatches an event `\Graphicms\GraphQL\Events\ServingGraphQL` every time a request is made to a GraphQL schema. Basic example: 

```php
<?php
app('events')->listen(ServingGraphQL::class, function () {
    $this->registerQueries(); // all your queries defined here
    $this->registerMutations(); // all your mutations defined here
});
```

You can use the same event to register types only when those are needed, but listen for the event early in the app lifecycle (like in the register method of a Service Provider)
:::

## Full example with Core Concepts

If you want to see a full working example using all the concepts learned in this section, you can see the [Basic GraphQL CRUD](/guide/examples/Basic-GraphQL-Crud.html) example.