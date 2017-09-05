const request = require('supertest');
const app = require('../app.js');

describe('GET /api/expenses', () => {
  it('should return 401', (done) => {
    request(app)
      .get('/api/expenses')
      .expect(401, done);
  });
});

describe('GET /random-url', () => {
  it('should return 404', (done) => {
    request(app)
      .get('/reset')
      .expect(404, done);
  });
});
