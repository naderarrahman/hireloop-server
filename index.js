import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config'

// MongoDB connection

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());



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
const jobsCollection = database.collection('jobs')


app.get('/', (req, res) => {
  res.send('Hireloop server is running');
});

app.get('/users', async (req, res) => {
    const cursor = usersCollection.find({});
  const allUsers = await cursor.toArray();

  res.json(allUsers);
});

app.post('/jobs', async (req, res) => {
  const result = await jobsCollection.insertOne(req.body);
  res.json(result);
});

app.get('/jobs', async (req, res) => {
  const cursor = jobsCollection.find({});
  const allJobs = await cursor.toArray();
  res.json(allJobs);
});

app.delete('/jobs/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await jobsCollection.deleteOne(query);
  res.json(result);
});


app.patch('/jobs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    
    delete updatedData._id; 

    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedData };
    
    const result = await jobsCollection.updateOne(filter, updateDoc);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update job" });
  }
});

app.get('/jobs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const job = await jobsCollection.findOne(query);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: "Invalid Job ID" });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});