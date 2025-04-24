import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const SECRET_KEY = `${process.env.APP_SECRET}`;

export const generateToken = (user: any) => {
  return jwt.sign(user, SECRET_KEY, { expiresIn: "15m" });
};

export const generateRefreshToken = (user: any) => {
  return jwt.sign(
    user,
    SECRET_KEY,
    { expiresIn: "7d" }
  );
};

// Verify token
export const verifyToken = (token:any)=> {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (error) {
    return null;
  }
}
