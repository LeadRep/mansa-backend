import express from 'express'
import { scrapeController } from './controllers/scrape'
import morgan from 'morgan'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
const port = 3000
app.use(cors())
app.use(express.json())
app.use(express.json())
app.use(morgan('dev'))
app.post('/scrape', scrapeController)
app.get('/', (req, res) => {
    res.json({ error: false, message: 'Welcome to Mansa Backend v2' })
})
app.listen(port, ()=>{
console.log(`App running at port ${port}`);
})
