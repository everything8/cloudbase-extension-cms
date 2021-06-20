import { IConfig } from 'umi'

const routesConfig: IConfig = {
  // umi routes: https://umijs.org/docs/routing
  routes: [
    {
      path: '/login',
      layout: false,
      component: './login',
    },
    {
      path: '/home',
      layout: false,
      access: 'isLogin',
      component: './home/index',
    },
    {
      path: '/settings',
      layout: false,
      access: 'isAdmin',
      wrappers: ['../components/SecurityWrapper/index'],
      routes: [
        {
          path: '/settings',
          component: './system-setting',
        },
        {
          exact: true,
          path: '/settings/role/edit',
          component: './system-setting/RoleManagement/RoleEditor/index',
        },
      ],
    },
    {
      path: '/',
      exact: true,
      redirect: '/home',
    },
    {
      path: '/redirect',
      exact: true,
      component: './redirect',
    },
    {
      path: '/project/',
      component: '../layout/index',
      layout: false,
      routes: [
        {
          exact: true,
          path: '/project/home',
          name: '概览',
          icon: 'eye',
          access: 'isLogin',
          wrappers: ['../components/SecurityWrapper/index'],
          component: './project/overview',
        },
        {
          exact: true,
          path: '/project/schema',
          name: '内容模型',
          icon: 'gold',
          access: 'canSchema',
          wrappers: ['../components/SecurityWrapper/index'],
          component: './project/schema/index',
        },
        {
          path: '/project/content',
          name: '内容集合',
          icon: 'database',
          access: 'canContent',
          wrappers: ['../components/SecurityWrapper/index'],
          routes: [
            {
              exact: true,
              path: '/project/content/:schemaId',
              component: './project/content/index',
            },
            {
              exact: true,
              path: '/project/content/:schemaId/edit',
              component: './project/content/ContentEditor',
            },
            {
              component: './project/content/index',
            },
          ],
        },
        {
          exact: true,
          path: '/project/setting',
          name: '项目设置',
          icon: 'setting',
          access: 'isAdmin',
          wrappers: ['../components/SecurityWrapper/index'],
          component: './project/setting/index',
        },
      ],
    },
    {
      component: './404',
    },
  ],
}

export default routesConfig
