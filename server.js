
const express = require("express");
const http = require("http");
const {Server} = require("socket.io");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

const USERS_FILE="users.json";

let users={};
if(fs.existsSync(USERS_FILE)){
 users=JSON.parse(fs.readFileSync(USERS_FILE));
}

let onlineUsers={};

function saveUsers(){
 fs.writeFileSync(USERS_FILE,JSON.stringify(users,null,2));
}

app.post("/signup",async(req,res)=>{
 const {username,password}=req.body;

 if(!username || !password){
  return res.send({success:false,message:"Missing fields"});
 }

 if(users[username]){
  return res.send({success:false,message:"User exists"});
 }

 const hash=await bcrypt.hash(password,10);

 users[username]={
  password:hash,
  friends:[],
  avatar:`https://api.dicebear.com/7.x/identicon/svg?seed=${username}`
 };

 saveUsers();

 res.send({success:true});
});

app.post("/login",async(req,res)=>{
 const {username,password}=req.body;

 if(!users[username]){
  return res.send({success:false});
 }

 const valid=await bcrypt.compare(password,users[username].password);

 if(valid){
  res.send({
   success:true,
   friends:users[username].friends,
   avatar:users[username].avatar
  });
 }else{
  res.send({success:false});
 }
});

app.post("/addfriend",(req,res)=>{

 const {user,friend}=req.body;

 if(!users[friend]){
  return res.send({success:false,message:"User not found"});
 }

 if(!users[user].friends.includes(friend)){
  users[user].friends.push(friend);
  saveUsers();
 }

 res.send({success:true,friends:users[user].friends});

});

io.on("connection",(socket)=>{

 socket.on("join",(username)=>{
  socket.username=username;
  onlineUsers[username]=socket.id;

  io.emit("online_users",Object.keys(onlineUsers));
 });

 socket.on("typing",(to)=>{
  if(onlineUsers[to]){
   io.to(onlineUsers[to]).emit("typing",socket.username);
  }
 });

 socket.on("private_message",({to,message})=>{

  if(onlineUsers[to]){
   io.to(onlineUsers[to]).emit("message",{
    from:socket.username,
    message
   });
  }

 });

 socket.on("disconnect",()=>{
  delete onlineUsers[socket.username];
  io.emit("online_users",Object.keys(onlineUsers));
 });

});

server.listen(3000,()=>{
 console.log("Server running on http://localhost:3000");
});
