require("dotenv").config();

module.exports = {
  development: {
    dialect: `postgres`,
    host: `${process.env.DB_HOST}`,
    username: `${process.env.DB_USERNAME}`,
    password: `${process.env.DB_PASSWORD}`,
    database: `${process.env.DB_DATABASE}`,
  },
};
