import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import 'dotenv/config'

const app = express();
const port = process.env.PORT || 5000;

const client = new MongoClient(`${process.env.MONGODB_URI}`);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const clients = await connectToMongoDB();
const database = clients.db('hireloop');
const usersCollection = database.collection('user');

// Middleware
app.use(cors());
app.use(express.json());



app.get('/', (req, res) => {
  res.send('Hireloop server is running');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});