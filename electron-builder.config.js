/**
 * Electron Builder 构建配置
 * 用于生成便携版exe文件
 */

const path = require('path');

// 生成时间戳 (HHMM格式)
function getTimeStamp() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}${minutes}`;
}

module.exports = {
  appId: 'com.automihoyo.all',
  productName: 'AUTO-mihoyo-all',
  copyright: 'Copyright © 2024 AUTO-mihoyo-all',
  
  directories: {
    output: 'dist',
    buildResources: 'assets'
  },
  
  files: [
    'src/**/*',
    'assets/**/*',
    'config.json.template',
    'launcher.bat',
    'debug-launcher.bat',
    'package.json',
    '!**/*.md',
    '!**/.git*',
    '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!**/node_modules/*.d.ts',
    '!**/node_modules/.bin',
    '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
    '!.editorconfig',
    '!**/._*',
    '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
    '!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}',
    '!**/{appveyor.yml,.travis.yml,circle.yml}',
    '!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}'
  ],
  
  extraFiles: [
    {
      from: 'config.json.template',
      to: 'config.json.template'
    },
    {
      from: 'launcher.bat',
      to: 'launcher.bat'
    },
    {
      from: 'debug-launcher.bat',
      to: 'debug-launcher.bat'
    },
    {
      from: 'TROUBLESHOOTING.md',
      to: 'TROUBLESHOOTING.md'
    }
  ],
  
  extraResources: [
    {
      from: 'config.json.template',
      to: 'config.json.template'
    }
  ],
  
  win: {
    target: [
      {
        target: 'portable',
        arch: ['x64']
      },
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'assets/icon.ico',
    artifactName: '${productName}-${version}-${arch}-${env.BUILD_TYPE}.${ext}',
    requestedExecutionLevel: 'asInvoker'
  },
  
  portable: {
    artifactName: `\${productName}-\${version}-${getTimeStamp()}.\${ext}`,
    requestedExecutionLevel: 'asInvoker'
  },
  
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    artifactName: '${productName}-${version}-setup.${ext}',
    shortcutName: '${productName}',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    menuCategory: '游戏工具',
    displayLanguageSelector: false,
    installerLanguages: ['zh_CN'],
    language: '2052'
  },
  
  extraMetadata: {
    main: 'src/main.js'
  },
  
  publish: null
};
