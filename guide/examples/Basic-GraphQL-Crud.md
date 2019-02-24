---
sidebarDepth: 3
---

# Basic GraphQL CRUD
## Requirements

Let's build a simple To Do system using [core concepts](/guide/Core-Concepts.html).

We will need to do the following steps:
* Create a new Service Provider to encapsulate behaviour
* Register a new scheme in GraphiCMS so that all our queries and mutations will be scoped there.
* Register the types we will work with: 
    * ToDoItem (id, list, task, done)
    * ToDoItemInput (task, done)
    * ToDoList (id, code, todos)
* Register our queries and mutations to do CRUD-like operations using GraphQL
    * todoList - returns a ToDoList
    * createTodoList - creates and returns a ToDoList
    * addTask - adds and returns a new Task on a ToDoList
    * markTaskAs - a simple operation to mark a task as done:true or false
    * editTask - Edit the task by id using the ToDoItemInput type
    * deleteTask - delete a task and return a boolean that indicates if it was deleted
    * deleteList - delete a ToDoList and return a boolean that indicates if it was deleted

The great thing about this example is that we will use models that extend `\Graphicms\Cms\Models\BaseModel` class and that is using a MongoDB connection. This way, we will not have to build migrations or complicated database architecture, we will use NoSQL and MongoDB will take care of your schema.

## Step by Step Code
### Create models

Let's start by creating our two new models we will work with: `ToDoList` and `ToDoItem`:

```bash
php artisan make:model ToDoList
php artisan make:model ToDoItem 
```

Open app/ToDoList.php, delete everything and add this:

```php
<?php

namespace App;

use Graphicms\Cms\Models\BaseModel;

class ToDoList extends BaseModel
{
    protected $collection = 'todo_lists';
}
```

Same thing for app/ToDoItem.php, paste this content:
```php
<?php

namespace App;

use Graphicms\Cms\Models\BaseModel;

class ToDoItem extends BaseModel
{
    protected $collection = 'todo_items';
}
```

For this example, we will keep it simple and do not specify relations for our models.

### Create service provider

Next step: create a new Service Provider in our app:
```bash
# creates app/Providers/ExampleServiceProvider.php
php artisan make:provider ExampleServiceProvider
```
Open the new created file and create a two new blank methods, we will fill those in the next steps:

```php
<?php
namespace App\Providers;
use Illuminate\Support\ServiceProvider;

class ExampleServiceProvider extends ServiceProvider
{
    public function register()
    {
    
    }
    
    public function boot()
    {
    
    }
}
```

Now, this is where we get our hands "dirty", we begin working with GraphQL engine itself. Until now all we did was basic Laravel stuff.

### Register a new schema

First thing we have to do is to create a new schema just for this functionality.

```php{4,10-14}
<?php
namespace App\Providers;
use Illuminate\Support\ServiceProvider;
use App\Http\Middleware\Authenticate;

class ExampleServiceProvider extends ServiceProvider
{
    public function register()
    {
        # step 1 - we want to register all of the example in a new schema
        \CmsQL::addNewScheme('todos', [
            'middleware' => ['web', Authenticate::class],
            'query'      => []
        ]);
    }
    
    public function boot()
    {
    
    }
}
```

### Register types

Next thing to do is to create our new types. We do this in the register method too, but only when GraphQL is serving.

```php{5,17-20}
<?php
namespace App\Providers;
use Illuminate\Support\ServiceProvider;
use App\Http\Middleware\Authenticate;
use Graphicms\GraphQL\Events\ServingGraphQL;

class ExampleServiceProvider extends ServiceProvider
{
    public function register()
    {
        # step 1 - we want to register all of the example in a new schema
        \CmsQL::addNewScheme('todos', [
            'middleware' => ['web', Authenticate::class],
            'query'      => []
        ]);
        
        # step 2 - we want to register our new types that we will work with
        $this->app['events']->listen(ServingGraphQL::class, function () {
        
        });
    }
    
    public function boot()
    {
    
    }
}
```

```php{6-9,24-62}
<?php
namespace App\Providers;
use Illuminate\Support\ServiceProvider;
use App\Http\Middleware\Authenticate;
use Graphicms\GraphQL\Events\ServingGraphQL;
use App\ToDoItem;
use App\ToDoList;
use Graphicms\Cms\GraphQL\DynamicType;
use GraphQL\Type\Definition\Type;

class ExampleServiceProvider extends ServiceProvider
{
    public function register()
    {
        # step 1 - we want to register all of the example in a new schema
        \CmsQL::addNewScheme('todos', [
            'middleware' => ['web', Authenticate::class],
            'query'      => []
        ]);
        
        # step 2 - we want to register our new types that we will work with
        $this->app['events']->listen(ServingGraphQL::class, function () {
        
        # register ToDoItem
        \CmsQL::addType(DynamicType::make([
            'name' => 'ToDoItem',
        ], [
            'id'   => ['type' => Type::nonNull(Type::string())],
            'list' => ['type' => function () {
                return \CmsQL::type('ToDoList');
            }, 'resolve'      => function ($root) {
                return ToDoList::query()->where('code', $root->code)->first();
            }],
            'task' => ['type' => Type::nonNull(Type::string())],
            'done' => ['type'    => Type::nonNull(Type::boolean()),
                       'resolve' => function ($root) {
                           return (bool)$root->done;
                       }],
        ]));
        
        # Register ToDoItemInput
        \CmsQL::addType(DynamicType::make([
            'name'  => 'ToDoItemInput',
            'input' => true,
        ], [
            'task' => ['type' => Type::nonNull(Type::string())],
            'done' => ['type' => Type::nonNull(Type::boolean())],
        ]));

        # Register ToDoList
        \CmsQL::addType(DynamicType::make([
            'name' => 'ToDoList',
        ], [
            'id'    => ['type' => Type::nonNull(Type::string())],
            'code'  => ['type' => Type::nonNull(Type::string())],
            'todos' => ['type'    => function () {
                return Type::listOf(\CmsQL::type('ToDoItem'));
            },
                'resolve' => function ($root) {
                    return ToDoItem::query()->where('code', $root->code)->get();
                }]
        ]));
        
        });
    }
    
    public function boot()
    {
    
    }
}
```

### Register queries and mutations

Now we can focus on the boot method where we will register the queries and mutations.

```php{10-11,23-158}
<?php
namespace App\Providers;
use Illuminate\Support\ServiceProvider;
use App\Http\Middleware\Authenticate;
use Graphicms\GraphQL\Events\ServingGraphQL;
use App\ToDoItem;
use App\ToDoList;
use Graphicms\Cms\GraphQL\DynamicType;
use GraphQL\Type\Definition\Type;
use Graphicms\Cms\GraphQL\DynamicMutation;
use Graphicms\Cms\GraphQL\DynamicQuery;

class ExampleServiceProvider extends ServiceProvider
{
    public function register()
    {
        // all of the above code
    }
    
    public function boot()
    {
        # step 3 - register queries and mutation for "crud" like operations
        $this->app['events']->listen(ServingGraphQL::class, function () {

            \CmsQL::addDynamicQuery(DynamicQuery::make([
                'name'     => 'todoList',
                'type'     => function () {
                    return \CmsQL::type('ToDoList');
                },
                'resolver' => function ($context, $arguments) {
                    $list = ToDoList::query()->where('code', $arguments['code'])->first();
                    return $list;
                },
                'args'     => function () {
                    return [
                        'code' => ['type' => Type::nonNull(Type::string())]
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'createTodoList',
                'type'     => function () {
                    return Type::nonNull(\CmsQL::type('ToDoList'));
                },
                'resolver' => function ($context, $arguments) {
                    return ToDoList::create([
                        'code' => $arguments['code']
                    ]);
                },
                'args'     => function () {
                    return [
                        'code' => ['type' => Type::nonNull(Type::string())]
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'addTask',
                'type'     => function () {
                    return Type::nonNull(\CmsQL::type('ToDoItem'));
                },
                'resolver' => function ($context, $arguments) {
                    return ToDoItem::create([
                        'code' => $arguments['listCode'],
                        'task' => $arguments['task'],
                    ]);
                },
                'args'     => function () {
                    return [
                        'listCode' => ['type' => Type::nonNull(Type::string())],
                        'task'     => ['type' => Type::nonNull(Type::string())],
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'markTaskAs',
                'type'     => function () {
                    return Type::nonNull(\CmsQL::type('ToDoItem'));
                },
                'resolver' => function ($context, $arguments) {
                    $item = ToDoItem::find($arguments['id']);
                    $item->done = $arguments['done'];
                    $item->save();

                    return $item;
                },
                'args'     => function () {
                    return [
                        'id'   => ['type' => Type::nonNull(Type::string())],
                        'done' => ['type' => Type::nonNull(Type::boolean())],
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'editTask',
                'type'     => function () {
                    return Type::nonNull(\CmsQL::type('ToDoItem'));
                },
                'resolver' => function ($context, $arguments) {
                    $item = ToDoItem::find($arguments['id']);
                    $item->task = $arguments['task']['task'];
                    $item->done = $arguments['task']['done'];
                    $item->save();

                    return $item;
                },
                'args'     => function () {
                    return [
                        'id'   => ['type' => Type::nonNull(Type::string())],
                        'task' => ['type' => Type::nonNull(\CmsQL::type('ToDoItemInput'))],
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'deleteTask',
                'type'     => function () {
                    return Type::nonNull(Type::boolean());
                },
                'resolver' => function ($context, $arguments) {
                    $item = ToDoItem::find($arguments['id']);
                    if (!$item) {
                        return false;
                    }
                    $item->delete();
                    return true;
                },
                'args'     => function () {
                    return [
                        'id' => ['type' => Type::nonNull(Type::string())],
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'deleteList',
                'type'     => function () {
                    return Type::nonNull(Type::boolean());
                },
                'resolver' => function ($context, $arguments) {
                    $item = ToDoList::whereCode($arguments['code'])->first();
                    if (!$item) {
                        return false;
                    }
                    $item->delete();
                    ToDoItem::where('code', $arguments['code'])->delete();
                    return true;
                },
                'args'     => function () {
                    return [
                        'code' => ['type' => Type::nonNull(Type::string())],
                    ];
                }
            ]), 'todos');
        });
    }
}
```
## Testing our new api schema with Graphiql

That's all, now we can use the queries and mutations in our GraphQL API. The final code is on the end of this page.

We can go to `http://[yourUrl]/graphi/graphiql/todos` and tinker with the api right in your browser. We can do the following queries and mutations now:

:::warning
Please note that your **ids returned in the response will be different**, make sure to change them.
:::

### Create a todo list

```graphql
mutation {
  createTodoList(code: "main") {
    id
    code
  }
}
# returns
{
  "data": {
    "createTodoList": {
      "id": "5c72656e39c5aae9c30ec636",
      "code": "main"
    }
  }
}
```

### Add a new task to the list

```graphql
mutation {
  addTask(listCode: "main", task: "Complete examples page") {
    id
    done
    list {
      id
    }
  }
}
# returns
{
  "data": {
    "addTask": {
      "id": "5c7265c139c5aae9c30ec637",
      "done": false,
      "list": {
        "id": "5c72656e39c5aae9c30ec636"
      }
    }
  }
}
```

### Get a todo list with all it's tasks

```graphql
{
  todoList(code: "main") {
    id
    code
    todos {
      id
      task
      done
    }
  }
}
# returns
{
  "data": {
    "todoList": {
      "id": "5c72656e39c5aae9c30ec636",
      "code": "main",
      "todos": [
        {
          "id": "5c7265c139c5aae9c30ec637",
          "task": "Complete examples page",
          "done": false
        }
      ]
    }
  }
}
```

### Mark a task as done or not done

```graphql
mutation {
  markTaskAs(id: "5c7265c139c5aae9c30ec637", done: true) {
    done
  }
}
# returns
{
  "data": {
    "markTaskAs": {
      "done": true
    }
  }
}
```

### Edit a task (task name and done status)

```graphql
mutation {
  editTask(id: "5c7265c139c5aae9c30ec637", task: {task: "Hello", done: false}) {
    id
    task
    done
  }
}
# returns
{
  "data": {
    "editTask": {
      "id": "5c7265c139c5aae9c30ec637",
      "task": "Hello",
      "done": false
    }
  }
}
```

### Delete a task from a list

```graphql
mutation {
  deleteTask(id: "5c7265c139c5aae9c30ec637")
}
# returns
{
  "data": {
    "deleteTask": true
  }
}
```

### Delete a whole list

```graphql
mutation {
  deleteList(code: "main")
}
# returns
{
  "data": {
    "deleteList": true
  }
}
```

As you can see, we've build the same operations a basic REST api would provide: getting an entity, editing it, deleting it, patching it. But the main thing is that we are using GraphQL which is way nicer and more modern.

## Final code


```php
<?php

namespace App\Providers;

use App\Http\Middleware\Authenticate;
use App\ToDoItem;
use App\ToDoList;
use Graphicms\Cms\GraphQL\DynamicMutation;
use Graphicms\Cms\GraphQL\DynamicQuery;
use Graphicms\Cms\GraphQL\DynamicType;
use Graphicms\GraphQL\Events\ServingGraphQL;
use GraphQL\Type\Definition\Type;
use Illuminate\Support\ServiceProvider;

class ExampleServiceProvider extends ServiceProvider
{
    public function register()
    {
        # step 1 - we want to register all of the example in a new schema
        \CmsQL::addNewScheme('todos', [
            'middleware' => ['web', Authenticate::class],
            'query'      => []
        ]);

        # step 2 - we want to register our new types that we will work with
        $this->app['events']->listen(ServingGraphQL::class, function () {
            # register ToDoItem
            \CmsQL::addType(DynamicType::make([
                'name' => 'ToDoItem',
            ], [
                'id'   => ['type' => Type::nonNull(Type::string())],
                'list' => ['type' => function () {
                    return \CmsQL::type('ToDoList');
                }, 'resolve'      => function ($root) {
                    return ToDoList::query()->where('code', $root->code)->first();
                }],
                'task' => ['type' => Type::nonNull(Type::string())],
                'done' => ['type'    => Type::nonNull(Type::boolean()),
                           'resolve' => function ($root) {
                               return (bool)$root->done;
                           }],
            ]));
            
            # Register ToDoItemInput
            \CmsQL::addType(DynamicType::make([
                'name'  => 'ToDoItemInput',
                'input' => true,
            ], [
                'task' => ['type' => Type::nonNull(Type::string())],
                'done' => ['type' => Type::nonNull(Type::boolean())],
            ]));

            # Register ToDoList
            \CmsQL::addType(DynamicType::make([
                'name' => 'ToDoList',
            ], [
                'id'    => ['type' => Type::nonNull(Type::string())],
                'code'  => ['type' => Type::nonNull(Type::string())],
                'todos' => ['type'    => function () {
                    return Type::listOf(\CmsQL::type('ToDoItem'));
                },
                            'resolve' => function ($root) {
                                return ToDoItem::query()->where('code', $root->code)->get();
                            }]
            ]));
        });
    }

    public function boot()
    {
        # step 3 - register queries and mutation for "crud" like operations
        $this->app['events']->listen(ServingGraphQL::class, function () {

            \CmsQL::addDynamicQuery(DynamicQuery::make([
                'name'     => 'todoList',
                'type'     => function () {
                    return \CmsQL::type('ToDoList');
                },
                'resolver' => function ($context, $arguments) {
                    $list = ToDoList::query()->where('code', $arguments['code'])->first();
                    return $list;
                },
                'args'     => function () {
                    return [
                        'code' => ['type' => Type::nonNull(Type::string())]
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'createTodoList',
                'type'     => function () {
                    return Type::nonNull(\CmsQL::type('ToDoList'));
                },
                'resolver' => function ($context, $arguments) {
                    return ToDoList::create([
                        'code' => $arguments['code']
                    ]);
                },
                'args'     => function () {
                    return [
                        'code' => ['type' => Type::nonNull(Type::string())]
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'addTask',
                'type'     => function () {
                    return Type::nonNull(\CmsQL::type('ToDoItem'));
                },
                'resolver' => function ($context, $arguments) {
                    return ToDoItem::create([
                        'code' => $arguments['listCode'],
                        'task' => $arguments['task'],
                    ]);
                },
                'args'     => function () {
                    return [
                        'listCode' => ['type' => Type::nonNull(Type::string())],
                        'task'     => ['type' => Type::nonNull(Type::string())],
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'markTaskAs',
                'type'     => function () {
                    return Type::nonNull(\CmsQL::type('ToDoItem'));
                },
                'resolver' => function ($context, $arguments) {
                    $item = ToDoItem::find($arguments['id']);
                    $item->done = $arguments['done'];
                    $item->save();

                    return $item;
                },
                'args'     => function () {
                    return [
                        'id'   => ['type' => Type::nonNull(Type::string())],
                        'done' => ['type' => Type::nonNull(Type::boolean())],
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'editTask',
                'type'     => function () {
                    return Type::nonNull(\CmsQL::type('ToDoItem'));
                },
                'resolver' => function ($context, $arguments) {
                    $item = ToDoItem::find($arguments['id']);
                    $item->task = $arguments['task']['task'];
                    $item->done = $arguments['task']['done'];
                    $item->save();

                    return $item;
                },
                'args'     => function () {
                    return [
                        'id'   => ['type' => Type::nonNull(Type::string())],
                        'task' => ['type' => Type::nonNull(\CmsQL::type('ToDoItemInput'))],
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'deleteTask',
                'type'     => function () {
                    return Type::nonNull(Type::boolean());
                },
                'resolver' => function ($context, $arguments) {
                    $item = ToDoItem::find($arguments['id']);
                    if (!$item) {
                        return false;
                    }
                    $item->delete();
                    return true;
                },
                'args'     => function () {
                    return [
                        'id' => ['type' => Type::nonNull(Type::string())],
                    ];
                }
            ]), 'todos');

            \CmsQL::addDynamicMutation(DynamicMutation::make([
                'name'     => 'deleteList',
                'type'     => function () {
                    return Type::nonNull(Type::boolean());
                },
                'resolver' => function ($context, $arguments) {
                    $item = ToDoList::whereCode($arguments['code'])->first();
                    if (!$item) {
                        return false;
                    }
                    $item->delete();
                    ToDoItem::where('code', $arguments['code'])->delete();
                    return true;
                },
                'args'     => function () {
                    return [
                        'code' => ['type' => Type::nonNull(Type::string())],
                    ];
                }
            ]), 'todos');
        });
    }
}
```

## Github & Package of demo
This demo has been packaged as a standalone plugin on Github: [filipac/graphi-demo-graphql-todos](https://github.com/filipac/graphi-demo-graphql-todos).

To add all this functionality in your app you just require it in you app:

`composer require filipac/graphi-demo-graphql-todos`

After this, Laravel will detect the package and you will have all the above functionality in your app automatically.

:::tip
Laravel will auto discover this package if you have php artisan package:discover in your composer.json file. If you removed it from composer.json file, be sure to run it manually.
:::