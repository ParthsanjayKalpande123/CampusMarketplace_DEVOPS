'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { config } = require('./config/env');
const requestLogger = require('./middleware/logger.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const { setLocals, requireAuth, requireAdmin } = require('./middleware/view.auth.middleware');
const adminService = require('./services/admin.service');
const reportService = require('./services/report.service');
const categoryService = require('./services/category.service');
const adminApiRoutes = require('./routes/admin.routes');
const authController = require('./controllers/auth.controller');

const adminApp = express();

adminApp.use(helmet({ contentSecurityPolicy: false, hsts: config.cookie.secure }));
adminApp.use(cors({ origin: config.cors.origin, credentials: true }));
adminApp.use(express.json({ limit: '1mb' }));
adminApp.use(express.urlencoded({ extended: true, limit: '1mb' }));
adminApp.use(cookieParser());
adminApp.use(requestLogger);
adminApp.set('view engine', 'ejs');
adminApp.set('views', path.join(__dirname, 'views'));
adminApp.use(express.static(path.join(__dirname, '..', 'public')));
adminApp.use(setLocals);
adminApp.use((req, res, next) => {
  res.locals.adminBase = '';
  return next();
});

adminApp.get('/login', (req, res) => {
  const adminOrigin = `${req.protocol}://${req.get('host')}`;
  const requestedRedirect = req.query.redirect || '/dashboard';
  const redirectPath = requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : '/dashboard';
  const redirectTarget = new URL(redirectPath, adminOrigin).toString();
  return res.render('pages/login', {
    title: 'Admin Login — Campus Marketplace',
    redirect: redirectTarget,
  });
});

adminApp.post('/api/v1/auth/login', authController.login);
adminApp.post('/api/v1/auth/logout', authController.logout);

adminApp.get('/', requireAuth, requireAdmin, (req, res) => res.redirect('/dashboard'));

adminApp.get('/dashboard', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [stats, categories] = await Promise.all([
      adminService.getStats(),
      categoryService.getActiveCategories(),
    ]);
    return res.render('pages/admin/dashboard', {
      title: 'Admin Dashboard — Campus Marketplace',
      stats,
      categories,
      adminPort: config.adminPort,
    });
  } catch (error) {
    return next(error);
  }
});

adminApp.get('/reports', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { reports, pagination } = await reportService.getReports(req.query);
    return res.render('pages/admin/reports', {
      title: 'Manage Reports — Campus Marketplace',
      reports,
      pagination,
      query: req.query,
    });
  } catch (error) {
    return next(error);
  }
});

adminApp.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { users, pagination } = await adminService.getUsers(req.query);
    return res.render('pages/admin/users', {
      title: 'Manage Users — Campus Marketplace',
      users,
      pagination,
      query: req.query,
    });
  } catch (error) {
    return next(error);
  }
});

adminApp.use('/api/v1/admin', adminApiRoutes);

adminApp.use((req, res) => res.status(404).render('pages/error', {
  title: '404 Not Found',
  statusCode: 404,
  message: 'Admin page not found.',
  isAuthenticated: res.locals.isAuthenticated,
  user: res.locals.user,
  currentPath: req.path,
}));
adminApp.use(errorMiddleware);

module.exports = adminApp;