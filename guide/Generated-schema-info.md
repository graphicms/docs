# Generated schema info

By default, when you register a new entity type in GraphiCMS and you let the system manage it, GraphiCMS registers a few GraphQL types, queries and mutations for you.

## Auto-generated GraphQL types

* {name}Type is the main type with the fields you register.
* {name}Collection is a system generated type that wraps your type and returns pagination data too.

A system `Collection` has the following fields:

```
{
    total,
    per_page,
    current_page,
    last_page,
    from,
    to,
    data[UserType fiedls]
}
```
* {name}Union - This is retuned by generated queries by GraphiCMS. An union can return one or more types, in our case the union returns either `UserType` or `UserCollection`, depending if you queried an entity by id or requested a list of entities. Read more about Unions [here](https://graphql.org/learn/schema/#union-types).