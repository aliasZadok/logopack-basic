module.exports = {
    siteUrl: 'https://logopack.app', 
    generateRobotsTxt: true,
    robotsTxtOptions: {
      policies: [
        { userAgent: '*', allow: '/' },
        { userAgent: 'Googlebot', disallow: '/private' },
      ],
    },
  };