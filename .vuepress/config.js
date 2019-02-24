module.exports = {

    title: 'GraphiCMS',

    description: 'The missing bridge between PHP and GraphQL/MongoDB developers',

    markdown: {
        lineNumbers: true
    },

    themeConfig: {
        nav: [{
                text: 'Home',
                link: '/'
            },
            {
                text: 'Guide',
                link: '/guide/'
            },
            {
                text: 'External',
                link: 'https://google.com'
            },
        ],
        sidebar: {
            '/guide/': [{
                    title: 'Documentation',
                    collapasble: true,
                    children: [
                        '',
                        'Core-Concepts',
                        'Generated-schema-info',
                    ]
                },
                {
                    title: 'Examples',
                    collapasble: true,
                    children: [
                        'examples/Basic-GraphQL-Crud',
                    ]
                }
            ]
        }
    }
}
