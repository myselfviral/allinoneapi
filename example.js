const fs = require('fs');
const axios = require('axios');
// call the packages we need
var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const {MessageMedia} = require('./src/structures');
var multer  = require('multer');
var upload = multer({ dest: 'uploads/' });

app.use(fileUpload({
    createParentPath: true
}));

app.use(cors());

const { Client, Location } = require('./index');

const SESSION_FILE_PATH = './session.json';
const responseObj = {};
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    //  sessionCfg = require(SESSION_FILE_PATH);  //  sessionCfg = require(SESSION_FILE_PATH);
}


// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('dev'));
var port = process.env.PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)



// more routes for our API will happen here

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);



//const client = new Client({ puppeteer: { headless: false , product: 'firefox',  args: ['-private', '-private-window'], executablePath: 'C:\\Program Files (x86)\\Mozilla Firefox\\firefox' }, session: sessionCfg });
const client = new Client({ puppeteer: {args: ['--no-sandbox'], ignoreDefaultArgs: ['--disable-extensions'] }, session: sessionCfg });
// You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.
// This object must include WABrowserId, WASecretBundle, WAToken1 and WAToken2.
client.preInitialize().then(() => {
    client.initialize();
});





client.on('qr', (qr) => {
    // NOTE: This event will not be fired if a sessssion is specified.
    console.log('QR RECEIVED', qr);
    // responseObj.qr = qr;
});

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    sessionCfg=session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessfull
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', () => {
    console.log('READY');
});


router.get('/init', async function(req, res) {
    
    //const client = new Client({ puppeteer: { headless: false , product: 'firefox',  args: ['-private', '-private-window'], executablePath: 'C:\\Program Files (x86)\\Mozilla Firefox\\firefox' }, session: sessionCfg });
    const newClient = new Client({ puppeteer: { args: ['--no-sandbox'],ignoreDefaultArgs: ['--disable-extensions'] }, session: sessionCfg });
    // You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.
    // This object must include WABrowserId, WASecretBundle, WAToken1 and WAToken2.
    try {
        await newClient.preInitialize().then(() => {
            
            newClient.initialize();
        });
        
    } catch (error) 
    {
        console.log(error);
    }
    responseObj.key= '!' + Math.random().toString(36).substr(2, 9);

    newClient.on('qr', (qr) => {
    // NOTE: This event will not be fired if a session is specified.
        console.log('new QR RECEIVED ', qr);
        responseObj.qr = qr;
    });

    newClient.on('authenticated', (session) => {
        console.log('new AUTHENTICATED', session);
        sessionCfg=session;
        responseObj.session = session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
            if (err) {
                console.error(err);
            }
        });
    });

    newClient.on('auth_failure', msg => {
    // Fired if session restore was unsuccessfull
        console.error('new AUTHENTICATION FAILURE', msg);
    });

    newClient.on('ready', () => {
        console.log('new READY');
    });

    
    newClient.on('message', async msg => {
        console.log('MESSAGE RECEIVED', msg);
        // add php api for send msg object  "msg"
        if (req.body.url) {
            axios.post(req.body.url,msg)
                .then(response => {
                    console.log(response.data);
                })
                .catch(error => {
                    console.log(error);
                });
        }

        if (msg.body == '!ping reply') {
        // Send a new message as a reply to the current one
            msg.reply('pong');

        } else if (msg.body == '!ping') {
        // Send a new message to the same chat
            client.sendMessage(msg.from, 'pong');

        } else if (msg.body.startsWith('!sendto ')) {
        // Direct send a new message to specific id
            let number = msg.body.split(' ')[1];
            let messageIndex = msg.body.indexOf(number) + number.length;
            let message = msg.body.slice(messageIndex, msg.body.length);
            number = number.includes('@c.us') ? number : `${number}@c.us`;
            let chat = await msg.getChat();
            chat.sendSeen();
            client.sendMessage(number, message);

        } else if (msg.body.startsWith('!subject ')) {
        // Change the group subject
            let chat = await msg.getChat();
            if (chat.isGroup) {
                let newSubject = msg.body.slice(9);
                chat.setSubject(newSubject);
            } else {
                msg.reply('This command can only be used in a group!');
            }
        } else if (msg.body.startsWith('!echo ')) {
        // Replies with the same message
            msg.reply(msg.body.slice(6));
        } else if (msg.body.startsWith('!desc ')) {
        // Change the group description
            let chat = await msg.getChat();
            if (chat.isGroup) {
                let newDescription = msg.body.slice(6);
                chat.setDescription(newDescription);
            } else {
                msg.reply('This command can only be used in a group!');
            }
        } else if (msg.body == '!leave') {
        // Leave the group
            let chat = await msg.getChat();
            if (chat.isGroup) {
                chat.leave();
            } else {
                msg.reply('This command can only be used in a group!');
            }
        } else if (msg.body.startsWith('!join ')) {
            const inviteCode = msg.body.split(' ')[1];
            try {
                await client.acceptInvite(inviteCode);
                msg.reply('Joined the group!');
            } catch (e) {
                msg.reply('That invite code seems to be invalid.');
            }
        } else if (msg.body == '!groupinfo') {
            let chat = await msg.getChat();
            if (chat.isGroup) {
                msg.reply(`
                *Group Details*
                Name: ${chat.name}
                Description: ${chat.description}
                Created At: ${chat.createdAt.toString()}
                Created By: ${chat.owner.user}
                Participant count: ${chat.participants.length}
            `);
            } else {
                msg.reply('This command can only be used in a group!');
            }
        } else if (msg.body == '!chats') {
            const chats = await client.getChats();
            client.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
        } else if (msg.body == '!info') {
            let info = client.info;
            client.sendMessage(msg.from, `
            *Connection info*
            User name: ${info.pushname}
            My number: ${info.me.user}
            Platform: ${info.platform}
            WhatsApp version: ${info.phone.wa_version}
        `);
        } else if (msg.body == '!mediainfo' && msg.hasMedia) {
            const attachmentData = await msg.downloadMedia();
            msg.reply(`
            *Media info*
            MimeType: ${attachmentData.mimetype}
            Filename: ${attachmentData.filename}
            Data (length): ${attachmentData.data.length}
        `);
        } else if (msg.body == '!quoteinfo' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();

            quotedMsg.reply(`
            ID: ${quotedMsg.id._serialized}
            Type: ${quotedMsg.type}
            Author: ${quotedMsg.author || quotedMsg.from}
            Timestamp: ${quotedMsg.timestamp}
            Has Media? ${quotedMsg.hasMedia}
        `);
        } else if (msg.body == '!resendmedia' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                const attachmentData = await quotedMsg.downloadMedia();
                client.sendMessage(msg.from, attachmentData, { caption: 'Here\'s your requested media.' });
            }
        } else if (msg.body == '!location') {
            msg.reply(new Location(37.422, -122.084, 'Googleplex\nGoogle Headquarters'));
        } else if (msg.location) {
            msg.reply(msg.location);
        } else if (msg.body.startsWith('!status ')) {
            const newStatus = msg.body.split(' ')[1];
            await client.setStatus(newStatus);
            msg.reply(`Status was updated to *${newStatus}*`);
        } else if (msg.body == '!mention') {
            const contact = await msg.getContact();
            const chat = await msg.getChat();
            chat.sendMessage(`Hi @${contact.number}!`, {
                mentions: [contact]
            });
        } else if (msg.body == '!delete' && msg.hasQuotedMsg) {
            const quotedMsg = await msg.getQuotedMessage();
            if (quotedMsg.fromMe) {
                quotedMsg.delete(true);
            } else {
                msg.reply('I can only delete my own messages');
            }
        } else if (msg.body === '!archive') {
            const chat = await msg.getChat();
            chat.archive();
        } else if (msg.body === '!typing') {
            const chat = await msg.getChat();
            // simulates typing in the chat
            chat.sendStateTyping();        
        } else if (msg.body === '!recording') {
            const chat = await msg.getChat();
            // simulates recording audio in the chat
            chat.sendStateRecording();        
        } else if (msg.body === '!clearstate') {
            const chat = await msg.getChat();
            // stops typing or recording in the chat
            chat.clearState();        
        }
    });

    newClient.on('message_create', (msg) => {
    // Fired on all message creations, including your own
        if (msg.fromMe) {
        // do stuff here
        }
    });

    newClient.on('message_revoke_everyone', async (after, before) => {
    // Fired whenever a message is deleted by anyone (including you)
        console.log(after); // message after it was deleted.
        if (before) {
            console.log(before); // message before it was deleted.
        }
    });

    newClient.on('message_revoke_me', async (msg) => {
    // Fired whenever a message is only deleted in your own view.
        console.log(msg.body); // message before it was deleted.
    });

    newClient.on('message_ack', (msg, ack) => {
    /*
        == ACK VALUES ==
        ACK_ERROR: -1
        ACK_PENDING: 0
        ACK_SERVER: 1
        ACK_DEVICE: 2
        ACK_READ: 3
        ACK_PLAYED: 4
    */

        if(ack == 3) {
        // The message was read
        }
    });

    newClient.on('group_join', (notification) => {
    // User has joined or been added to the group.
        console.log('join', notification);
        notification.reply('User joined.');
    });

    newClient.on('group_leave', (notification) => {
    // User has left or been kicked from the group.
        console.log('leave', notification);
        notification.reply('User left.');
    });

    newClient.on('group_update', (notification) => {
    // Group picture, subject or description has been updated.
        console.log('update', notification);
    });

    newClient.on('change_battery', (batteryInfo) => {
    // Battery percentage for attached device has changed
        const { battery, plugged } = batteryInfo;
        console.log(`Battery: ${battery}% - Charging? ${plugged}`);
    });

    newClient.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
    });

    router.post(`/${responseObj.key}/send`, async function(req, res) {
        console.log('reqest ', req);
        const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
        try {
            await newClient.sendMessage(number, req.body.msg);
        }
        catch(err)
        {
            console.log(err);
        }
        res.json({ message: 'hooray! Message Sent!' });   
    });

    router.post(`/${responseObj.key}/sendfile`, async (req, res) => {
        console.log('req => ', req);
        const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
        function base64_encode(file) {
            var bitmap = fs.readFileSync(file);
            return new Buffer.from(bitmap).toString('base64');
        }

  
        try {
            if(!req.files) {
                res.send({
                    status: false,
                    message: 'No file uploaded'
                });
            } else {
                //Use the name of the input field (i.e. "avatar") to retrieve the uploaded filere
                
                let avatar = req.files.avatar;
                
                await avatar.mv('./uploads/' + avatar.name);
                var ImageFileToSave = await base64_encode('./uploads/' + avatar.name);
               
                const objfile = new MessageMedia(avatar.mimetype,ImageFileToSave,avatar.name);
                console.log(objfile);
                newClient.sendMessage(number, objfile);
                //send response
                res.send({
                    status: true,
                    message: 'File is uploaded',
                    data: {
                        name: avatar.name,
                        mimetype: avatar.mimetype,
                        size: avatar.size
                    }
                });
            }
        } catch (err) {
            res.status(500).send(err);
        }
    });

    router.post(`/${responseObj.key}/sendfiles`, async (req, res) => {
        console.log('req => ', req);
        const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
        function base64_encode(file) {
            var bitmap = fs.readFileSync(file);
            return new Buffer.from(bitmap).toString('base64');
        }

  
        try {
            if(!req.files) {
                res.send({
                    status: false,
                    message: 'No file uploaded'
                });
            } else {
                let data = []; 
                
                //loop all files
                _.forEach(_.keysIn(req.files.files), async (key) => {
                    let file = req.files.files[key];
                    //move photo to uploads directory
                    await file.mv('./uploads/' + file.name);
    
                    //push file details
                    data.push({
                        name: file.name,
                        mimetype: file.mimetype,
                        size: file.size
                    });


                    var ImageFileToSave = await base64_encode('./uploads/' + file.name);
                    const objfile = new MessageMedia(file.mimetype,ImageFileToSave,file.name);
                    await newClient.sendMessage(number, objfile);

                });
                            

                //send response
                res.send({
                    status: true,
                    message: 'Files are uploaded and Sent',
                    data: data
                });
            }
        } catch (err) {
            res.status(500).send(err);
        }
    });

    responseObj.qr= newClient.test;
    res.json(responseObj);   
});
client.on('message', async msg => {
    console.log('MESSAGE RECEIVED', msg);
    // add php api for send msg object  "msg"
    if (msg.body == '!ping reply') {
        // Send a new message as a reply to the current one
        msg.reply('pong');

    } else if (msg.body == '!ping') {
        // Send a new message to the same chat
        client.sendMessage(msg.from, 'pong');

    } else if (msg.body.startsWith('!sendto ')) {
        // Direct send a new message to specific id
        let number = msg.body.split(' ')[1];
        let messageIndex = msg.body.indexOf(number) + number.length;
        let message = msg.body.slice(messageIndex, msg.body.length);
        number = number.includes('@c.us') ? number : `${number}@c.us`;
        let chat = await msg.getChat();
        chat.sendSeen();
        client.sendMessage(number, message);

    } else if (msg.body.startsWith('!subject ')) {
        // Change the group subject
        let chat = await msg.getChat();
        if (chat.isGroup) {
            let newSubject = msg.body.slice(9);
            chat.setSubject(newSubject);
        } else {
            msg.reply('This command can only be used in a group!');
        }
    } else if (msg.body.startsWith('!echo ')) {
        // Replies with the same message
        msg.reply(msg.body.slice(6));
    } else if (msg.body.startsWith('!desc ')) {
        // Change the group description
        let chat = await msg.getChat();
        if (chat.isGroup) {
            let newDescription = msg.body.slice(6);
            chat.setDescription(newDescription);
        } else {
            msg.reply('This command can only be used in a group!');
        }
    } else if (msg.body == '!leave') {
        // Leave the group
        let chat = await msg.getChat();
        if (chat.isGroup) {
            chat.leave();
        } else {
            msg.reply('This command can only be used in a group!');
        }
    } else if (msg.body.startsWith('!join ')) {
        const inviteCode = msg.body.split(' ')[1];
        try {
            await client.acceptInvite(inviteCode);
            msg.reply('Joined the group!');
        } catch (e) {
            msg.reply('That invite code seems to be invalid.');
        }
    } else if (msg.body == '!groupinfo') {
        let chat = await msg.getChat();
        if (chat.isGroup) {
            msg.reply(`
                *Group Details*
                Name: ${chat.name}
                Description: ${chat.description}
                Created At: ${chat.createdAt.toString()}
                Created By: ${chat.owner.user}
                Participant count: ${chat.participants.length}
            `);
        } else {
            msg.reply('This command can only be used in a group!');
        }
    } else if (msg.body == '!chats') {
        const chats = await client.getChats();
        client.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
    } else if (msg.body == '!info') {
        let info = client.info;
        client.sendMessage(msg.from, `
            *Connection info*
            User name: ${info.pushname}
            My number: ${info.me.user}
            Platform: ${info.platform}
            WhatsApp version: ${info.phone.wa_version}
        `);
    } else if (msg.body == '!mediainfo' && msg.hasMedia) {
        const attachmentData = await msg.downloadMedia();
        msg.reply(`
            *Media info*
            MimeType: ${attachmentData.mimetype}
            Filename: ${attachmentData.filename}
            Data (length): ${attachmentData.data.length}
        `);
    } else if (msg.body == '!quoteinfo' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();

        quotedMsg.reply(`
            ID: ${quotedMsg.id._serialized}
            Type: ${quotedMsg.type}
            Author: ${quotedMsg.author || quotedMsg.from}
            Timestamp: ${quotedMsg.timestamp}
            Has Media? ${quotedMsg.hasMedia}
        `);
    } else if (msg.body == '!resendmedia' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.hasMedia) {
            const attachmentData = await quotedMsg.downloadMedia();
            client.sendMessage(msg.from, attachmentData, { caption: 'Here\'s your requested media.' });
        }
    } else if (msg.body == '!location') {
        msg.reply(new Location(37.422, -122.084, 'Googleplex\nGoogle Headquarters'));
    } else if (msg.location) {
        msg.reply(msg.location);
    } else if (msg.body.startsWith('!status ')) {
        const newStatus = msg.body.split(' ')[1];
        await client.setStatus(newStatus);
        msg.reply(`Status was updated to *${newStatus}*`);
    } else if (msg.body == '!mention') {
        const contact = await msg.getContact();
        const chat = await msg.getChat();
        chat.sendMessage(`Hi @${contact.number}!`, {
            mentions: [contact]
        });
    } else if (msg.body == '!delete' && msg.hasQuotedMsg) {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.fromMe) {
            quotedMsg.delete(true);
        } else {
            msg.reply('I can only delete my own messages');
        }
    } else if (msg.body === '!archive') {
        const chat = await msg.getChat();
        chat.archive();
    } else if (msg.body === '!typing') {
        const chat = await msg.getChat();
        // simulates typing in the chat
        chat.sendStateTyping();        
    } else if (msg.body === '!recording') {
        const chat = await msg.getChat();
        // simulates recording audio in the chat
        chat.sendStateRecording();        
    } else if (msg.body === '!clearstate') {
        const chat = await msg.getChat();
        // stops typing or recording in the chat
        chat.clearState();        
    }
});

client.on('message_create', (msg) => {
    // Fired on all message creations, including your own
    if (msg.fromMe) {
        // do stuff here
    }
});

client.on('message_revoke_everyone', async (after, before) => {
    // Fired whenever a message is deleted by anyone (including you)
    console.log(after); // message after it was deleted.
    if (before) {
        console.log(before); // message before it was deleted.
    }
});

client.on('message_revoke_me', async (msg) => {
    // Fired whenever a message is only deleted in your own view.
    console.log(msg.body); // message before it was deleted.
});

client.on('message_ack', (msg, ack) => {
    /*
        == ACK VALUES ==
        ACK_ERROR: -1
        ACK_PENDING: 0
        ACK_SERVER: 1
        ACK_DEVICE: 2
        ACK_READ: 3
        ACK_PLAYED: 4
    */

    if(ack == 3) {
        // The message was read
    }
});

client.on('group_join', (notification) => {
    // User has joined or been added to the group.
    console.log('join', notification);
    notification.reply('User joined.');
});

client.on('group_leave', (notification) => {
    // User has left or been kicked from the group.
    console.log('leave', notification);
    notification.reply('User left.');
});

client.on('group_update', (notification) => {
    // Group picture, subject or description has been updated.
    console.log('update', notification);
});

client.on('change_battery', (batteryInfo) => {
    // Battery percentage for attached device has changed
    const { battery, plugged } = batteryInfo;
    console.log(`Battery: ${battery}% - Charging? ${plugged}`);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

