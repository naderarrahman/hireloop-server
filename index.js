import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config'
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
const applicationsCollection = database.collection('applications')
const paymentsCollection = database.collection('payments')




app.get('/', (req, res) => {
  res.send('Hireloop server is running');
});

app.get('/users', async (req, res) => {
    const cursor = usersCollection.find({});
  const allUsers = await cursor.toArray();

  res.json(allUsers);
});

app.patch('/users/:id/role', async (req, res) => {
  try {
    const id = req.params.id;
    const { role } = req.body;

    const allowedRoles = ['seeker', 'recruiter', 'admin'];
    if (!role || !allowedRoles.includes(role.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Valid role (seeker, recruiter, admin) is required",
      });
    }

    // Better Auth-এ _id অনেক সময় ObjectId অথবা string হতে পারে, তাই উভয়ভাবেই চেক করা নিরাপদ
    const query = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { $or: [{ _id: id }, { id: id }] };

    const updateDoc = {
      $set: {
        role: role.toLowerCase(),
        updatedAt: new Date(),
      },
    };

    const result = await usersCollection.updateOne(query, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "User role updated successfully",
      result,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ success: false, error: "Failed to update user role" });
  }
});

app.post('/jobs', async (req, res) => {
  const result = await jobsCollection.insertOne(req.body);
  res.json(result);
});

app.get('/jobs', async (req, res) => {
  console.log("Query received:", req.query);

  const query = {};

  if (req.query.jobType) {
    query.jobType = req.query.jobType;
  }

  if (req.query.isRemote) {
    query.isRemote = req.query.isRemote === "true";
  }

  if (req.query.category) {
    const categories = req.query.category.split(",");
    query.category = { $in: categories };
  }

  if(req.query.recruiterId){
    query.recruiterId = req.query.recruiterId;
  }

  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, "i");
    
    query.$or = [
      { jobTitle: searchRegex },
      { companyName: searchRegex },
      { category: searchRegex },  
      { jobType: searchRegex },
      { location: searchRegex },    
      { qualifications: searchRegex },
    ];
  }

  const cursor = jobsCollection.find(query);
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

//premiumUser
app.get('/users/:id/isPremium', async (req,res)=> {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const user = await usersCollection.findOne(query);
    res.json({ isPremium: user.isPremium || false });
})

//application collection
app.get('/applications/count', async (req, res) => {
  const query = {};
  if(req.query.userId) {
    query.userId = req.query.userId;
  }
const count = await applicationsCollection.countDocuments(query);
  res.json({ count : count });
});

app.get('/applications', async (req, res) => {
  const query = {};
  if(req.query.userId) {
    query.userId = req.query.userId;
  }

  if(req.query.jobId){
    query.jobId = req.query.jobId;
  }

  const cursor = applicationsCollection.find(query);
  const allApplications = await cursor.toArray();
  res.json(allApplications);
});

app.post('/applications', async (req, res) => {
  try {
    const applicationsData = {
      ...req.body,
      appliedAt: new Date(), 
    };
    
    const result = await applicationsCollection.insertOne(applicationsData);
    
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to submit application" });
  }
});

app.patch('/applications/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        status: status,
        updatedAt: new Date(),
      },
    };

    const result = await applicationsCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    res.json({ success: true, message: "Status updated successfully", result });
  } catch (error) {
    console.error("Error updating application status:", error);
    res.status(500).json({ success: false, error: "Failed to update application status" });
  }
});




// Stripe payment intent endpoint
app.post('/payment/verify-payment', async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    const stripeSession = await stripe.checkout.sessions.retrieve(session_id);

    if (stripeSession.status === 'complete' && stripeSession.payment_status === 'paid') {
      
      const existingPayment = await paymentsCollection.findOne({ sessionId: session_id });

      if (existingPayment) {
        return res.json({ success: false, message: 'Payment already verified' });
      }

      const paymentData = {
        sessionId: session_id, 
        customer_email: stripeSession.customer_email,
        payment_intent: stripeSession.payment_intent,
        metadata: stripeSession.metadata,
        payment_status: stripeSession.payment_status,
        userId: stripeSession.metadata.userId,
        createdAt: new Date(),
      };

      const result = await paymentsCollection.insertOne(paymentData);
      
      const query = { _id: new ObjectId(stripeSession.metadata.userId) };
      const updateDoc = { $set: { isPremium: true } };
      
      const updateResult = await usersCollection.updateOne(query, updateDoc);
      
      return res.json({ 
        success: true, 
        message: 'Payment verified and user updated to premium',
        result, 
        updateResult 
      });
    }
    
    return res.json({ success: false, message: 'Payment not verified' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});






app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});