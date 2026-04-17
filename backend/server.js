require("dotenv").config({ path: __dirname + "/.env" });
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const Razorpay = require("razorpay");

const io = new Server(server, {
  cors: {
    origin: ["http://127.0.0.1:5500", "http://localhost:5500", "https://localfix-seven.vercel.app"],
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500", "https://localfix-seven.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});



// 🔥 DB connect
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log(err));

// 🔥 SCHEMA (yahan likhna hai)
const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  password: String,
  otp: String,
  gender: String,
  addresses: [{
  label: String,
  address: String,
  city: String
  }],
  savedWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Worker" }], 
  status: {
    type: String,
    default: "pending" // 🔥 default
  }
});
const User = mongoose.model("User", userSchema);

const workerSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  aadhar: String,
  category: String,
  skills: [String],
  rate:Number,
  password: String,
  otp: String,
  email:String,
  city:String,
  experience:String,
  radius: { type: Number, default: 5 }, 
  bankAccount: {
  holderName: String,
  accountNumber: String,
  ifsc: String,
  bankName: String,
  verified: { type: Boolean, default: false }
  },
  payout: {
  frequency: { type: String, default: "weekly" },
  minAmount: { type: Number, default: 500 }
  },
  isOnline: { type: Boolean, default: false },
  location: {
  type: { type: String, default: "Point" },
  coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  rating: { type: Number, default: 0 },
  totalJobs: { type: Number, default: 0 },
  available: { type: Boolean, default: false },
  walletBalance: { type: Number, default: 0 },
  status: {
    type: String,
    default: "pending"
  }
});

const Worker = mongoose.model("Worker", workerSchema);
Worker.collection.createIndex({ location: "2dsphere" });


const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },
  category: String,
  subService: String,
  address: {
    label: String,
    address: String,
    city: String
  },
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number] // user ki location [lng, lat]
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "arriving", "started", "completed", "cancelled"],
    default: "pending"
  },
  otp: String,
  amount: Number,
  rating: { type: Number, default: 0 },
  review: String,
  tags: [String],
  comment: String, 
  paymentId: String,
  paymentStatus: { type: String, default: "pending" },
  commission: Number,
  workerEarning: Number,
  totalPaid: Number,
  createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model("Booking", bookingSchema);

const messageSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  senderId: String,      // userId ya workerId
  senderRole: String,    // "user" ya "worker"
  message: String,
  type: { type: String, default: "text" }, // text ya image
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", messageSchema);

const reportSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  reportedBy: String,
  issue: String,
  description: String,
  createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model("Report", reportSchema);

const withdrawalSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },
  amount: Number,
  status: { type: String, default: "pending" }, // pending, paid
  createdAt: { type: Date, default: Date.now }
});
const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", default: null },
  type: String,  // "worker_accepted", "payment_done", etc.
  title: String,
  message: String,
  isRead: { type: Boolean, default: false },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
  createdAt: { type: Date, default: Date.now }
});
const Notification = mongoose.model("Notification", notificationSchema);

// ✅ test
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.APP_PASS // 🔥 normal password nahi
  }
});

//otp generate
function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}


//otp generate for phone number

async function sendSmsOtp(phone, otp) {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      "authorization": process.env.FAST2SMS_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      route: "q",                          // 👈 "otp" ki jagah "q"
      message: `Your LocalFix OTP is ${otp}. Do not share with anyone.`,
      language: "english",
      numbers: cleanPhone
    })
  });

  const data = await response.json();
  console.log("Fast2SMS response:", data);
  return data;
}


// User resend OTP
app.post("/api/auth/resend-otp", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const otp = generateOtp();
  await User.updateOne({ email }, { $set: { otp } });

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "LocalFix OTP Verification",
    text: `Your new OTP is ${otp}`
  });

  res.json({ success: true, message: "OTP resent" });
});

// Worker resend OTP
app.post("/api/worker/resend-otp", async (req, res) => {
  const { phone } = req.body;
  const worker = await Worker.findOne({ phone });

  if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });

  const otp = 1234;
  await Worker.updateOne({ phone }, { $set: { otp } });
  await sendSmsOtp(phone, otp);

  res.json({ success: true, message: "OTP resent" });
});



// User verify otp
app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.otp || user.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  // 🔥 ye use karo - $set + $unset directly DB mein
  await User.updateOne(
    { email },
    {
      $set: { status: "approved" },
      $unset: { otp: "" }
    }
  );

  res.json({
    success: true,
    message: "Email verified ✅"
  });
});

//Worker verify otp

app.post("/api/worker/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;

  const worker = await Worker.findOne({ phone });

  if (!worker) {
    return res.status(404).json({ success: false, message: "Worker not found" });
  }

  if (!worker.otp || worker.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  await Worker.updateOne(
    { phone },
    { $set: { status: "approved" }, $unset: { otp: "" } }
  );

  res.json({ success: true, message: "Phone verified ✅" });
});





// ✅ user login jwt 


app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: "All fields required" });

  try {
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user.status !== "approved")
      return res.status(403).json({ success: false, message: "Email not verified" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: "Wrong password" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
       user: { _id: user._id, name: user.name, email: user.email, phone: user.phone }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err); // 👈 ye add karo
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ user signup
// 🔥 temporary DB (upar likhna hai, routes ke bahar)
app.post("/api/auth/signup", async (req, res) => {
  const { name, phone, email, password } = req.body;
  console.log("Signup hit:", req.body);
  if (!name || !phone || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  try {
    // 🔍 duplicate check
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // 🔥 OTP generate
    const otp = generateOtp();

    // 💾 save user with pending status
    const newUser = new User({
      name,
      phone,
      email,
      password: hashedPassword,
      otp,
      status: "pending"
    });

    await newUser.save();

    // 📧 send email
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: "LocalFix OTP Verification",
      text: `Your OTP is ${otp}`
    });

    console.log("User saved + OTP sent");

    res.json({
      success: true,
      message: "OTP sent to email"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

//Worker login

app.post("/api/worker/login", async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }

  try {
    const worker = await Worker.findOne({ phone });

    if (!worker) {
      return res.status(404).json({ success: false, message: "Worker not found" });
    }

    if (worker.status !== "approved") {
      return res.status(403).json({ success: false, message: "Phone not verified" });
    }

    const isMatch = await bcrypt.compare(password, worker.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Wrong password" });
    }

    const token = jwt.sign(
      { workerId: worker._id, role: "worker" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      worker: { _id: worker._id, name: worker.name, phone: worker.phone, category: worker.category }
    });

  } catch (err) {
    console.error("WORKER LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ✅ worker Signup
app.post("/api/worker/register", async (req, res) => {
  const { name, phone, aadhar, category, skills, password } = req.body;

  if (!name || !phone || !aadhar || !category || !password) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }

  try {
    const existing = await Worker.findOne({ phone });
    
    // 👇 Agar approved hai to block karo
    if (existing && existing.status === "approved") {
      return res.status(400).json({ success: false, message: "Phone already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = 1234;

    if (existing && existing.status === "pending") {
      // 👇 Purana pending record update karo — naya OTP set karo
      await Worker.updateOne({ phone }, {
        $set: { name, aadhar, category, skills: skills || [], password: hashedPassword, otp }
      });
    } else {
      const newWorker = new Worker({
        name, phone, aadhar, category,
        skills: skills || [],
        password: hashedPassword,
        otp,
        status: "pending"
      });
      await newWorker.save();
    }

    await sendSmsOtp(phone, otp);
    console.log("Worker saved + OTP sent:", otp);
    res.json({ success: true, message: "OTP sent to phone" });

  } catch (err) {
    console.error("WORKER REGISTER ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Booking create route

app.post("/api/booking/create", authMiddleware, async (req, res) => {
  const { category, subService, latitude, longitude, address } = req.body;

  try {
    const categoryMap = {
      "ac": "ac",
      "electrician": "electrician",
      "plumber": "plumber",
      "cleaning": "cleaner",
      "mechanic": "mechanic",
      "carpenter": "carpenter",
      "painter": "painter",
      "repair": "repair"
    };

    const mappedCategory = categoryMap[category] || category;

    const workers = await Worker.find({
      isOnline: true,
      category: { $regex: mappedCategory, $options: "i" },
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: 10000
        }
      }
    }).limit(5);

    if (workers.length === 0) {
      return res.json({ success: false, message: "No workers available nearby" });
    }

    const otp = generateOtp();

    const booking = new Booking({
      user: req.userId,
      worker: workers[0]._id,
      category,
      subService,
      address,
      location: { type: "Point", coordinates: [longitude, latitude] },
      otp
    });

    await booking.save();
    // booking.save() ke baad ye add karo temporarily
    console.log("Worker socket:", connectedWorkers[workers[0]._id.toString()]);
    console.log("All connected workers:", connectedWorkers);
    const user = await User.findById(req.userId).select("name phone");

    const workerSocketId = connectedWorkers[workers[0]._id.toString()];
    if (workerSocketId) {
      io.to(workerSocketId).emit("new-booking", {
        bookingId: booking._id,
        userName: user.name,        // 👈 real name
        userPhone: user.phone,      // 👈 real phone
        category,
        subService,
        address,
        userLat: latitude,   // 👈 ye add karo
        userLng: longitude  
      });
    }
    await createNotification({
      workerId: workers[0]._id,
      type: "new_booking",
      title: "New Request! 🔔",
      message: `${category} request - ${address.city || address.address}`,
      bookingId: booking._id
    });
    res.json({
      success: true,
      bookingId: booking._id,
      worker: {
        name: workers[0].name,
        category: workers[0].category,
        phone: workers[0].phone
      }
    });

  } catch (err) {
    console.error("BOOKING ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Middleware — token verify karo
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
}

// User profile fetch
app.get("/api/auth/profile", authMiddleware, async (req, res) => {
  const user = await User.findById(req.userId).select("-password -otp");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, user });
});

// User profile update
app.put("/api/auth/profile", authMiddleware, async (req, res) => {
  const { name, phone, gender, addresses} = req.body;
  await User.updateOne({ _id: req.userId }, { $set: { name, phone, gender, addresses} });
  res.json({ success: true, message: "Profile updated" });
});


function workerAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.workerId = decoded.workerId;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
}

app.get("/api/worker/profile", workerAuthMiddleware, async (req, res) => {
  const worker = await Worker.findById(req.workerId).select("-password -otp");
  if (!worker) return res.status(404).json({ success: false, message: "Worker not found" });

  // Stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalJobs = await Booking.countDocuments({ worker: req.workerId, status: "completed" });
  const monthlyBookings = await Booking.find({ worker: req.workerId, status: "completed", createdAt: { $gte: startOfMonth } });
  const monthlyEarnings = monthlyBookings.reduce((sum, b) => sum + (b.workerEarning || 0), 0);

  res.json({ success: true, worker: { ...worker.toObject(), totalJobs, monthlyEarnings } });
});

app.put("/api/worker/profile", workerAuthMiddleware, async (req, res) => {
  const { name, phone, email, city, experience, category, skills, rate, radius, bankAccount, payout, isOnline  } = req.body;
  await Worker.updateOne(
    { _id: req.workerId },
    { $set: { name, phone, email, city, experience, category, skills, rate, radius, bankAccount, payout, isOnline } }
  );
  res.json({ success: true, message: "Profile updated" });
});

app.put("/api/worker/location", workerAuthMiddleware, async (req, res) => {
  const { latitude, longitude } = req.body;
  await Worker.updateOne(
    { _id: req.workerId },
    { $set: { location: { type: "Point", coordinates: [longitude, latitude] } } }
  );
  res.json({ success: true });
});



app.get("/api/booking/:id/otp", authMiddleware, async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ success: false });
  res.json({ success: true, otp: booking.otp });
});

app.post("/api/booking/:id/verify-otp", workerAuthMiddleware, async (req, res) => {
  const { otp } = req.body;
  const booking = await Booking.findById(req.params.id);
  
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
  if (booking.otp !== otp) return res.status(400).json({ success: false, message: "Wrong OTP" });
  
  await Booking.updateOne({ _id: req.params.id }, { $set: { status: "started" } });
  res.json({ success: true });
});

app.get("/api/chat/:bookingId", authMiddleware, async (req, res) => {
  const messages = await Message.find({ 
    bookingId: req.params.bookingId 
  }).sort({ createdAt: 1 });
  res.json({ success: true, messages });
});

app.post("/api/report", authMiddleware, async (req, res) => {
  const { bookingId, issue, description } = req.body;
  const report = new Report({
    bookingId,
    reportedBy: req.userId,
    issue,
    description
  });
  await report.save();
  res.json({ success: true, message: "Report submitted" });
});


app.post("/api/booking/:id/complete", authMiddleware, async (req, res) => {
  await Booking.updateOne({ _id: req.params.id }, { $set: { status: "completed" } });
  
  const booking = await Booking.findById(req.params.id);
  
  // Worker ko notify karo
  const workerSocketId = connectedWorkers[booking.worker.toString()];
  if (workerSocketId) {
    io.to(workerSocketId).emit("job-completed", { bookingId: req.params.id });
  }
  await createNotification({
    userId: booking.user,
    type: "rate_experience",
    title: "Rate Your Experience",
    message: `How was the service? Tap to rate.`,
    bookingId: booking._id
  });
  
  res.json({ success: true });
});
app.post("/api/booking/:id/rating", authMiddleware, async (req, res) => {
  try {
    const { rating, review, tags, comment } = req.body;
    
    // Booking mein save karo
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { rating, review, tags, comment } },
      { new: true }
    );

    // Worker ka average rating update karo
    const allBookings = await Booking.find({ 
      worker: booking.worker, 
      rating: { $exists: true, $gt: 0 } 
    });
    
    const avgRating = allBookings.reduce((sum, b) => sum + b.rating, 0) / allBookings.length;
    
    await Worker.findByIdAndUpdate(booking.worker, { 
      rating: Math.round(avgRating * 10) / 10,
      totalJobs: allBookings.length
    });

    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/worker/reviews", workerAuthMiddleware, async (req, res) => {
  const bookings = await Booking.find({
    worker: req.workerId,
    status: "completed",
    rating: { $gt: 0 }
  })
  .populate("user", "name")
  .select("user rating comment tags subService category createdAt")  // ✅ ye add kro
  .sort({ createdAt: -1 });

  // ✅ Average rating backend se calculate karke bhejna better hai
  const totalRatings = bookings.length;
  const avgRating = totalRatings > 0
    ? (bookings.reduce((sum, b) => sum + b.rating, 0) / totalRatings).toFixed(1)
    : "0.0";

  res.json({ 
    success: true, 
    bookings,
    avgRating,      // ✅ frontend ko seedha mil jayega
    totalRatings    // ✅ ye bhi
  });
});

// User bookings
app.get("/api/user/bookings", authMiddleware, async (req, res) => {
  const bookings = await Booking.find({ 
    user: req.userId,
    status: { $in: ["completed", "cancelled"] }  // 👈 sirf ye do
  }).populate("worker", "name").sort({ createdAt: -1 });
  res.json({ success: true, bookings });
});

// Worker jobs
app.get("/api/worker/jobs", workerAuthMiddleware, async (req, res) => {
  const bookings = await Booking.find({ 
    worker: req.workerId,
    status: { $in: ["completed", "cancelled"] }  // 👈 sirf ye do
  }).populate("user", "name").sort({ createdAt: -1 });
  res.json({ success: true, bookings });
});

app.post("/api/booking/:id/amount", workerAuthMiddleware, async (req, res) => {
  const { amount } = req.body;
  await Booking.updateOne({ _id: req.params.id }, { $set: { amount } });
  res.json({ success: true });
});


app.post("/api/payment/create-order", authMiddleware, async (req, res) => {
  const { amount, bookingId } = req.body;
  
  const order = await razorpay.orders.create({
    amount: amount * 100, // paise mein (rupees * 100)
    currency: "INR",
    receipt: bookingId
  });

  res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
});

// Payment verify route
app.post("/api/payment/verify", authMiddleware, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
  
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  const generated_signature = hmac.digest("hex");

  if (generated_signature === razorpay_signature) {
    // Payment verified — booking update karo
    const booking = await Booking.findById(bookingId);
    const commission = Math.round(booking.amount * 0.10);
    const workerEarning = booking.amount; 
    const totalPaid = booking.amount + commission;

    await Booking.updateOne({ _id: bookingId }, { 
      $set: { 
        paymentId: razorpay_payment_id,
        paymentStatus: "paid",
        commission,
        workerEarning,
        totalPaid: booking.amount + commission
      } 
    });
    // Worker wallet update karo
    await Worker.updateOne(
      { _id: booking.worker },
      { $inc: { walletBalance: workerEarning } }
    );

    // Socket se dono ko notify karo
    const userSocketId = connectedUsers[booking.user.toString()];
    const workerSocketId = connectedWorkers[booking.worker.toString()];
    
    if (userSocketId) io.to(userSocketId).emit("payment-done", { bookingId });
    if (workerSocketId) io.to(workerSocketId).emit("payment-done", { bookingId, workerEarning });
    await createNotification({
      userId: booking.user,
      type: "payment_done",
      title: "Payment Successful",
      message: `₹${totalPaid} paid successfully.`,  
      bookingId: booking._id
    });
    await createNotification({
      workerId: booking.worker,
      type: "payment_done",
      title: "Payment Received",
      message: `₹${workerEarning} added to your wallet.`,
      bookingId: booking._id
    });

    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: "Payment verification failed" });
  }
});



app.get("/api/worker/dashboard-stats", workerAuthMiddleware, async (req, res) => {
  const workerId = req.workerId;

  // Total jobs
  const totalJobs = await Booking.countDocuments({ 
    worker: workerId, 
    status: "completed" 
  });

  // Average rating
  const ratingData = await Booking.aggregate([
    { $match: { worker: new mongoose.Types.ObjectId(workerId), rating: { $gt: 0 } } },
    { $group: { _id: null, avgRating: { $avg: "$rating" } } }
  ]);
  const avgRating = ratingData[0]?.avgRating?.toFixed(1) || "0.0";

  // This month earnings
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const earningsData = await Booking.aggregate([
    { $match: { 
      worker: new mongoose.Types.ObjectId(workerId), 
      status: "completed",
      createdAt: { $gte: startOfMonth }
    }},
    { $group: { _id: null, total: { $sum: "$workerEarning" } } }
  ]);
  const thisMonth = earningsData[0]?.total || 0;

  // Recent 3 jobs
  const recentJobs = await Booking.find({ 
    worker: workerId, 
    status: "completed" 
  }).sort({ createdAt: -1 }).limit(3);

  res.json({ success: true, totalJobs, avgRating, thisMonth, recentJobs });
});


app.get("/api/worker/earnings", workerAuthMiddleware, async (req, res) => {
  const workerId = req.workerId;

  const now = new Date();
  
  // This month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // This week
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Today
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [monthData, weekData, todayData, recentPayments, worker, withdrawals] = await Promise.all([
    Booking.aggregate([
      { $match: { worker: new mongoose.Types.ObjectId(workerId), status: "completed", createdAt: { $gte: startOfMonth } }},
      { $group: { _id: null, total: { $sum: "$workerEarning" }, count: { $sum: 1 }, avg: { $avg: "$workerEarning" } }}
    ]),
    Booking.aggregate([
      { $match: { worker: new mongoose.Types.ObjectId(workerId), status: "completed", createdAt: { $gte: startOfWeek } }},
      { $group: { _id: null, total: { $sum: "$workerEarning" } }}
    ]),
    Booking.aggregate([
      { $match: { worker: new mongoose.Types.ObjectId(workerId), status: "completed", createdAt: { $gte: startOfDay } }},
      { $group: { _id: null, total: { $sum: "$workerEarning" } }}
    ]),
    Booking.find({ worker: workerId, status: "completed" })
      .sort({ createdAt: -1 }).limit(5),
    Worker.findById(workerId).select("walletBalance"),
    Withdrawal.find({ worker: workerId }).sort({ createdAt: -1 }).limit(5) 
  ]);

  res.json({
    success: true,
    thisMonth: monthData[0]?.total || 0,
    monthJobs: monthData[0]?.count || 0,
    avgPerJob: Math.round(monthData[0]?.avg || 0),
    thisWeek: weekData[0]?.total || 0,
    today: todayData[0]?.total || 0,
    walletBalance: worker?.walletBalance || 0,
    recentPayments,
    withdrawals 
  });
});

app.post("/api/worker/withdraw", workerAuthMiddleware, async (req, res) => {
  const { amount } = req.body;
  const worker = await Worker.findById(req.workerId);
  
  if (!worker.walletBalance || worker.walletBalance < 100) {
    return res.json({ success: false, message: "Insufficient balance" });
  }

  // Withdrawal request save karo
  const withdrawal = new Withdrawal({
    worker: req.workerId,
    amount: worker.walletBalance,
    status: "pending"
  });
  await withdrawal.save();

  // Balance zero karo (pending mein hai)
  await Worker.updateOne({ _id: req.workerId }, { $set: { walletBalance: 0 } });

  res.json({ success: true });
});


app.post("/api/admin/withdrawal/:id/paid", async (req, res) => {
  await Withdrawal.updateOne({ _id: req.params.id }, { $set: { status: "paid" } });
  
  const withdrawal = await Withdrawal.findById(req.params.id);
  const workerSocketId = connectedWorkers[withdrawal.worker.toString()];
  if (workerSocketId) {
    io.to(workerSocketId).emit("withdrawal-paid", { amount: withdrawal.amount });
  }
  await createNotification({
    workerId: withdrawal.worker,
    type: "withdrawal_paid",
    title: "Payout Done! 🎉",
    message: `₹${withdrawal.amount} sent to your bank account.`,
  });
  
  res.json({ success: true });
});


// Nearby workers
app.get("/api/workers/nearby", authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, category } = req.query;
    
    if (!latitude || !longitude || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
      return res.status(400).json({ success: false, message: "Invalid coordinates" });
    }

    const categoryMap = {
      "ac": "ac",
      "electrician": "electrician",
      "plumber": "plumber",
      "cleaning": "cleaner",
      "mechanic": "mechanic",
      "carpenter": "carpenter",
      "painter": "painter",
      "repair": "repair"
    };
    const mappedCategory = category ? (categoryMap[category] || category) : null;

    const workers = await Worker.find({
      isOnline: true,
      ...(mappedCategory && { category: { $regex: mappedCategory, $options: "i" } }),
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
          $maxDistance: 10000
        }
      }
    }).limit(6).select("name category skills rate experience location");

    // Har worker ki rating aur totalJobs calculate karo
    const workersWithStats = await Promise.all(workers.map(async (w) => {
      const ratingData = await Booking.aggregate([
        { $match: { worker: w._id, status: "completed", rating: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
      ]);
      
      return {
        _id: w._id,
        name: w.name,
        category: w.category,
        skills: w.skills,
        rate: w.rate,
        experience: w.experience,
        location: w.location,
        rating: ratingData[0]?.avg?.toFixed(1) || null,
        totalJobs: ratingData[0]?.count || 0
      };
    }));

    res.json({ success: true, workers: workersWithStats });
    
  } catch (err) {
    console.error("NEARBY ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Book again
app.get("/api/user/book-again", authMiddleware, async (req, res) => {
  const bookings = await Booking.find({
    user: req.userId,
    status: "completed"
  }).populate("worker", "name").sort({ createdAt: -1 }).limit(3);

  res.json({ success: true, bookings });
});

// User notifications fetch
app.get("/api/notifications", authMiddleware, async (req, res) => {
  const notifications = await Notification.find({ userId: req.userId })
    .sort({ createdAt: -1 }).limit(50);
  await Notification.updateMany({ userId: req.userId }, { $set: { isRead: true } });
  res.json({ success: true, notifications });
});

// Worker notifications fetch
app.get("/api/worker/notifications", workerAuthMiddleware, async (req, res) => {
  const notifications = await Notification.find({ workerId: req.workerId })
    .sort({ createdAt: -1 }).limit(50);
  await Notification.updateMany({ workerId: req.workerId }, { $set: { isRead: true } });
  res.json({ success: true, notifications });
});

// Unread count
app.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
  const count = await Notification.countDocuments({ userId: req.userId, isRead: false });
  res.json({ success: true, count });
});
app.get("/api/worker/notifications/unread-count", workerAuthMiddleware, async (req, res) => {
  const count = await Notification.countDocuments({ 
    workerId: req.workerId, 
    isRead: false 
  });
  res.json({ success: true, count });
});


app.get("/api/user/active-chats", authMiddleware, async (req, res) => {
  try {
    console.log("userId from token:", req.userId); 
    const bookings = await Booking.find({
      user: req.userId,
      status: { $in: ["accepted", "arriving", "started", "completed"] }
    }).populate("worker", "name category").sort({ createdAt: -1 });
    console.log("Bookings found:", bookings.length); // 👈 ADD KARO
    console.log("Sample booking:", JSON.stringify(bookings[0], null, 2));

    res.json({ success: true, bookings });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});





// Save/Unsave worker toggle
app.post("/api/user/save-worker/:workerId", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const workerId = req.params.workerId;
    const index = user.savedWorkers.indexOf(workerId);
    
    if (index === -1) {
      user.savedWorkers.push(workerId);
      await user.save();
      res.json({ success: true, saved: true });
    } else {
      user.savedWorkers.splice(index, 1);
      await user.save();
      res.json({ success: true, saved: false });
    }
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get saved workers list
app.get("/api/user/saved-workers", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("savedWorkers");
    res.json({ success: true, workers: user.savedWorkers });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


app.post("/api/booking/:id/cancel", authMiddleware, async (req, res) => {
  console.log("🔥 Cancel route hit:", req.params.id);
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { $set: { status: "cancelled" } },
    { new: true }
  );
  
  // 👇 Yeh console logs add karo
  console.log("Booking:", booking);
  console.log("booking.worker:", booking?.worker);
  console.log("connectedWorkers:", connectedWorkers);
  const workerSocketId = connectedWorkers[booking.worker.toString()];
  console.log("workerSocketId:", workerSocketId);
  console.log("Emitting to:", workerSocketId); //
  
  if (workerSocketId) {
    io.to(workerSocketId).emit("booking-cancelled", { bookingId: req.params.id });
    console.log("✅ Event emitted to worker");
  }
  
  res.json({ success: true });
});

app.get("/api/worker/:id/location", authMiddleware, async (req, res) => {
  const worker = await Worker.findById(req.params.id).select("location");
  if (!worker) return res.status(404).json({ success: false });
  const [lng, lat] = worker.location.coordinates;
  res.json({ success: true, location: { lat, lng } });
});


const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `worker-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// Photo upload route
app.post("/api/worker/upload-photo", workerAuthMiddleware, upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file" });
  
  const photoUrl = `/uploads/${req.file.filename}`;
  await Worker.updateOne({ _id: req.workerId }, { $set: { photo: photoUrl } });
  
  res.json({ success: true, photoUrl });
});

// Static folder serve karo
app.use("/uploads", express.static("uploads"));







// Connected workers track karo
const connectedWorkers = {}; // { workerId: socketId }
const connectedUsers = {};   // { userId: socketId }

async function createNotification({ userId, workerId, type, title, message, bookingId }) {
  const notif = new Notification({ userId, workerId, type, title, message, bookingId });
  await notif.save();
  if (userId) {
    const socketId = connectedUsers[userId.toString()];
    if (socketId) io.to(socketId).emit("new-notification", { type, title, message, bookingId });
  }
  if (workerId) {
    const socketId = connectedWorkers[workerId.toString()];
    if (socketId) io.to(socketId).emit("new-notification", { type, title, message, bookingId });
  }
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Worker connect hone pe register karo
  socket.on("worker-register", (workerId) => {
    connectedWorkers[workerId] = socket.id;
    console.log("Worker registered:", workerId);
  });

  // User connect hone pe register karo
  socket.on("user-register", (userId) => {
    connectedUsers[userId] = socket.id;
    console.log("User registered:", userId);
  });

  // Worker ne accept kiya
  socket.on("booking-accepted", async ({ bookingId, workerId }) => {
    await Booking.updateOne({ _id: bookingId }, { $set: { status: "accepted" } });
    const booking = await Booking.findById(bookingId).populate("worker");
    const userSocketId = connectedUsers[booking.user.toString()];
    if (userSocketId) {
      io.to(userSocketId).emit("worker-accepted", {
        workerName: booking.worker.name,
        workerPhone: booking.worker.phone,
        workerCategory: booking.worker.category,
        bookingId,
        workerId: booking.worker._id
      });
    }
    await createNotification({
      userId: booking.user,
      type: "worker_accepted",
      title: "Worker Assigned",
      message: `${booking.worker.name} accepted your request. On the way!`,
      bookingId: booking._id
    });
  });

  socket.on("worker-location", ({ bookingId, lat, lng }) => {
  if (!bookingId) return;
  Booking.findById(bookingId).then(booking => {
    if (!booking) return;
    const userSocketId = connectedUsers[booking.user.toString()];
    
    // ✅ ANDAR karo yeh logs
    console.log("connectedUsers:", connectedUsers);
    console.log("booking.user:", booking.user.toString());
    console.log("userSocketId:", userSocketId);
    
    if (userSocketId) {
      io.to(userSocketId).emit("worker-location-update", { lat, lng });
    }
  });
});

  // Message send karo
  socket.on("send-message", async ({ bookingId, senderId, senderRole, message }) => {
    // DB mein save karo
    const msg = new Message({ bookingId, senderId, senderRole, message });
    await msg.save();

    // Booking fetch karo dono ko bhejne ke liye
    const booking = await Booking.findById(bookingId);
    const payload = {
      bookingId,
      senderId,
      senderRole,
      message,
      createdAt: msg.createdAt
    };

    // Dono ko bhejo (sender ko bhi taaki confirm ho)
    const userSocketId = connectedUsers[booking.user.toString()];
    const workerSocketId = connectedWorkers[booking.worker.toString()];

    if (userSocketId) io.to(userSocketId).emit("receive-message", payload);
    if (workerSocketId) io.to(workerSocketId).emit("receive-message", payload);
  });



  socket.on("job-started", async ({ bookingId }) => {
    const booking = await Booking.findById(bookingId);
    const userSocketId = connectedUsers[booking.user.toString()];
    if (userSocketId) {
      io.to(userSocketId).emit("job-started", { bookingId });
    }
  });




  // Worker ne reject kiya
  socket.on("booking-rejected", async ({ bookingId, workerId }) => {
    await Booking.updateOne({ _id: bookingId }, { $set: { status: "cancelled" } });
    const booking = await Booking.findById(bookingId);
    const userSocketId = connectedUsers[booking.user.toString()];
    if (userSocketId) {
      io.to(userSocketId).emit("worker-rejected", { bookingId });
    }
    await createNotification({
      userId: booking.user,
      type: "worker_rejected",
      title: "Booking Cancelled",
      message: "No worker available right now. Please try again.",
      bookingId: booking._id
    });
  });

  socket.on("payment-request", async ({ bookingId, amount }) => {
    const booking = await Booking.findById(bookingId);
    const userSocketId = connectedUsers[booking.user.toString()];
    if (userSocketId) {
      io.to(userSocketId).emit("payment-request", { bookingId, amount });
    }
  });


  socket.on("disconnect", () => {
    // Remove from maps
    Object.keys(connectedWorkers).forEach(k => {
      if (connectedWorkers[k] === socket.id) delete connectedWorkers[k];
    });
    Object.keys(connectedUsers).forEach(k => {
      if (connectedUsers[k] === socket.id) delete connectedUsers[k];
    });
  });
});

// app.listen ki jagah server.listen
server.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("🚀 Server running on http://localhost:3000");
});
