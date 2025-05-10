const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
var app = express();
var server = app.listen(8080, function(){
    console.log("listening on port 8080");
});
const fs = require('fs');
const fileUpload = require("express-fileupload");
app.use(fileUpload());
const io = require("socket.io")(server, {
    allowEIO3: true,
});
const connectDB = require("./db");
connectDB();
const userSchema = new mongoose.Schema({
    connectionId: String,
    user_id: String,
    meeting_id: String,
    timestamp: { type: Date, default: Date.now },
});
const UserConnection = mongoose.model("UserConnection", userSchema);
app.use(express.static(path.join(__dirname, "")));
var userConnections = [];

io.on("connection", (socket) => {
    console.log("socket id is ", socket.id);

    socket.on("userconnect", async (data) => {
        console.log("userconnect", data.displayName, data.meetingid);

        var other_users = userConnections.filter((p) => p.meeting_id == data.meetingid);
        //Save the new connection to both the in-memory array and MongoDB
        const userData = {
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingid,
        };
        //Save to MongoDB
        try {
            const newUser = new UserConnection(userData);
            await newUser.save();
            console.log("User saved to MongoDB:", userData);
        } catch (err) {
            console.error("Error saving user to MongoDB:", err);
        }

        userConnections.push({
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingid,
        });

        var userCount = userConnections.length;
        console.log(userCount);

        other_users.forEach((v) => {
            socket.to(v.connectionId).emit("inform_others_about_me", {
                other_user_id: data.displayName,
                connId: socket.id,
                userNumber: userCount
            });
        });

        // Emit this to inform the current user about other users after they connect
        socket.emit("inform_me_about_other_user", other_users);
    });

    socket.on("SDPProcess", (data) => {
        socket.to(data.to_connid).emit("SDPProcess", {
            message: data.message,
            from_connid: socket.id,
        });
    });

    socket.on("sendMessage", (msg)=>{
        console.log(msg);
        var mUser = userConnections.find((p)=>p.connectionId == socket.id);
        if(mUser){
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p)=>p.meeting_id == meetingid);
            list.forEach((v)=>{
                socket.to(v.connectionId).emit("showChatMessage", {
                    from: from,
                    message: msg
                })
            })
        }
    })

    socket.on("fileTransferToOther", (msg)=>{
        console.log(msg);
        var mUser = userConnections.find((p)=>p.connectionId == socket.id);
        if(mUser){
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p)=>p.meeting_id == meetingid);
            list.forEach((v)=>{
                socket.to(v.connectionId).emit("showFileMessage", {
                    username: msg.username,
                    meetingid: msg.meetingid,
                    filePath: msg.filePath,
                    fileName: msg.fileName,
                })
            })
        }
    })

    socket.on("disconnect", function(){
        console.log("Disconnected");
        var disUser = userConnections.find((p) => p.connectionId == socket.id);
        if(disUser){
            var meetingid = disUser.meeting_id;
            userConnections = userConnections.filter((p) => p.connectionId != socket.id);
            var list = userConnections.filter((p)=>p.meeting_id == meetingid);
            list.forEach((v) => {
                var userNumberAfUserLeave = userConnections.length;
                socket.to(v.connectionId).emit("inform_other_about_disconnected_user", {
                    connId : socket.id,
                    uNumber: userNumberAfUserLeave
                });
            })
        }
    })
});

app.post("/attachimg", function(req, res){
    var data = req.body;
    var imageFile = req.files.zipfile;
    console.log(imageFile);
    var dir = "public/attachment/" + data.meeting_id+"/";
    if(!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }

    imageFile.mv("public/attachment/" + data.meeting_id + "/" + imageFile.name, function(error){
        if(error){
            console.log("could not upload image file", error);
        }
        else{
            console.log("imageFile successfully uploaded");
        }
    })
})