const fs = require('fs');
const axios = require('axios');
// call the packages we need
var https = require('https')
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
const typeorm = require("typeorm");
const Sessions = require("./src/model/sessions").sessions;
const eventlog = require("./src/model/eventlog").eventlog;
app.use(fileUpload({
    createParentPath: true
}));

app.use(cors());

/* https.createServer({
    key: fs.readFileSync('/root/ssl/crmtiger.key'),
    cert: fs.readFileSync('/root/ssl/STAR_crmtiger_com.crt')
  }, app)
  .listen(443, function () {
    console.log('Example app listening on port 443! Go to https://wa.crmtiger.com:443/')
  }) */

const { Client, Location } = require('./index');
const { default: Axios } = require('axios');
const { forEach } = require('lodash');
const WAWebJS = require('./index');
const { Session } = require('inspector');

const SESSION_FILE_PATH = './session.json';
const responseObj = {};
const AllObj = {};
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
 //    sessionCfg = require(SESSION_FILE_PATH);  //  sessionCfg = require(SESSION_FILE_PATH);
}


// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('dev'));
var port = process.env.PORT || 443;        // set our port

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


typeorm.createConnection().then(async function (connection) {

   
        let sessionsRepository = connection.getRepository(Sessions);
        let eventlogRepo = connection.getRepository(eventlog);
        sessionsRepository.find({ isActive : 1 }).then( values => {
        values.forEach(async value => {

           // const nClient = new Client({ puppeteer: {headless: false}, session: value.session });
              const nClient = new Client({ puppeteer: {args: ['--no-sandbox'],ignoreDefaultArgs: ['--disable-extensions'] }, session: value.session });
              // You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.
              // This object must include WABrowserId, WASecretBundle, WAToken1 and WAToken2.
              try {
                  await nClient.preInitialize().then(() => {
                          
                      nClient.initialize();
                  });
                      
              } catch (error) 
              {
                  console.log(error);
              }
              responseObj.key= value.apikey;
      
              nClient.on('qr', (qr) => {
                  // NOTE: This event will not be fired if a session is specified.
                  console.log('new QR RECEIVED ', qr);
                  responseObj.qr = qr;
      
                  if (value.statusurl) {
                      axios.post(value.statusurl, { message: 'New QR Generated',value:qr }  )
                          .then(response => {
                              console.log('REQ URL ',value.statusurl);
                              console.log('response ',response.data);
                          })
                          .catch(error => {
                              console.log(error);
                          });
                  }
              });
      
              nClient.on('authenticated', async (session) => {
                  console.log('AUTHENTICATED', session);
                  sessionCfg=session;
                  responseObj.number = session.number;
                  responseObj.name = session.name;
                  let sessionsRepository = connection.getRepository(Sessions);
                  await sessionsRepository.delete({ number: session.number }  );
                  const sesobj = new Sessions(0,session,session.number,responseObj.key,1,value.url,value.licenceKey,value.statusurl);
                  await sessionsRepository.save(sesobj).then(values => { AllObj.CSession = values }); 
              });
      
              nClient.on('auth_failure', msg => {
                  // Fired if session restore was unsuccessfull
                  console.error('AUTHENTICATION FAILURE', msg);
                  if (value.statusurl) {
                      axios.post(value.statusurl,{ message: 'Authentication Fail',value:msg })
                          .then(response => {
                              console.log('REQ URL ',value.statusurl);
                              console.log('response ',response.data);
                              let sessionsRepository = connection.getRepository(Sessions);
                              const sesobj = new Sessions(AllObj.CSession.id,AllObj.CSession.session,AllObj.CSession.session.number,responseObj.key,0,value.url,value.licenceKey,value.statusurl);
                              sessionsRepository.save(sesobj).then(values => { AllObj.CSession = values });
                          })
                          .catch(error => {
                              console.log(error);
                          });
                  }
              });
      
              nClient.on('ready',  () => {
                  console.log('new READY');
                  if (value.statusurl) {
                      axios.post(value.statusurl, { message: 'Status Connected',value:'Connected' })
                          .then(response => {
                              console.log('REQ URL ',value.statusurl);
                              console.log('response ',response.data);
                          })
                          .catch(error => {
                              console.log(error);
                          });
                  }
              });
      
                  
              nClient.on('message', async msg => {
                  console.log('MESSAGE RECEIVED', msg);
                  let attachmentData;
                  if(msg.hasMedia)
                  {
                      attachmentData = await msg.downloadMedia();
                      msg.fileData = attachmentData;
                  }
                      
                  console.log('msg = >', msg);
                  // add php api for send msg object  "msg"
                  if (value.url) {
                      axios.post(value.url,msg)
                          .then(response => {
                              console.log('REQ URL ',value.url);
                              console.log('response ',response.data);
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
                      nClient.sendMessage(msg.from, 'pong');
      
      
                  } else if (msg.body.startsWith('!sendto ')) {
                      // Direct send a new message to specific id
                      let number = msg.body.split(' ')[1];
                      let messageIndex = msg.body.indexOf(number) + number.length;
                      let message = msg.body.slice(messageIndex, msg.body.length);
                      number = number.includes('@c.us') ? number : `${number}@c.us`;
                      let chat = await msg.getChat();
                      
                      chat.sendSeen();
                      nClient.sendMessage(number, message);
      
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
                          await nClient.acceptInvite(inviteCode);
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
                      const chats = await nClient.getChats();
                      nClient.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
                  } else if (msg.body == '!info') {
                      let info = nClient.info;
                      nClient.sendMessage(msg.from, `
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
                          nClient.sendMessage(msg.from, attachmentData,{ caption: 'Here\'s your requested media.' });
                      }
                  } else if (msg.body == '!location') {
                      msg.reply(new Location(37.422, -122.084, 'Googleplex\nGoogle Headquarters'));
                  } else if (msg.location) {
                      msg.reply(msg.location);
                  } else if (msg.body.startsWith('!status ')) {
                      const newStatus = msg.body.split(' ')[1];
                      await nClient.setStatus(newStatus);
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
      
              nClient.on('message_create', (msg) => {
                  // Fired on all message creations, including your own
                  if (msg.fromMe) {
                      // do stuff here
                  }
              });
      
              nClient.on('message_revoke_everyone', async (after, before) => {
                  // Fired whenever a message is deleted by anyone (including you)
                  console.log(after); // message after it was deleted.
                  if (before) {
                      console.log(before); // message before it was deleted.
                  }
              });
      
              nClient.on('message_revoke_me', async (msg) => {
                  // Fired whenever a message is only deleted in your own view.
                  console.log(msg.body); // message before it was deleted.
              });
      
              nClient.on('message_ack', (msg, ack) => {
                  /*
                      == ACK VALUES ==
                      ACK_ERROR: -1
                      ACK_PENDING: 0
                      ACK_SERVER: 1
                      ACK_DEVICE: 2
                      ACK_READ: 3
                      ACK_PLAYED: 4
                  */
                 console.log('before ack =>',ack );
                  if(ack == 3) {
                      // The message was read
                   
                      const actmsg = { id:msg.id , ack:msg.ack }
                      if (value.url) {
                          axios.post(value.url,actmsg)
                              .then(response => {
                                  console.log('REQ URL ',value.url);
                                  console.log('actmsg sent ',actmsg );
                              })
                              .catch(error => {
                                  console.log(error);
                              });
                      }
      
                  }
              });
      
              nClient.on('group_join', (notification) => {
                  // User has joined or been added to the group.
                  console.log('join', notification);
                //  notification.reply('User joined.');
              });
      
              nClient.on('group_leave', (notification) => {
                  // User has left or been kicked from the group.
                  console.log('leave', notification);
                 // notification.reply('User left.');
              });
      
              nClient.on('group_update', (notification) => {
                  // Group picture, subject or description has been updated.
                  console.log('update', notification);
              });
      
              nClient.on('change_battery', (batteryInfo) => {
                  // Battery percentage for attached device has changed
                  const { battery, plugged } = batteryInfo;
                  console.log(`Battery: ${battery}% - Charging? ${plugged}`);
              });
              nClient.on('change_state', (state) => {
                if (value.statusurl) {
                    axios.post(value.statusurl, { message: 'Status changed',value:state })
                        .then(response => {
                            console.log('REQ URL ',value.url);
                            console.log('response ',response.data);
                        })
                        .catch(error => {
                            console.log(error);
                        });
                }
                
                console.log(`State : ${state}`);
            });
      
              nClient.on('disconnected', (reason) => {
                  console.log('nClient was logged out', reason);
                  if (value.statusurl) {
                      axios.post(value.statusurl, { message: 'Status Disconnected',value:'disconnected' })
                          .then(response => {
                              
                              let sessionsRepository = connection.getRepository(Sessions);
                              const sesobj = new Sessions(AllObj.CSession.id,AllObj.CSession.session,AllObj.CSession.session.number,responseObj.key,0,value.url,value.licenceKey,value.statusurl);
                              sessionsRepository.save(sesobj).then(values => { AllObj.CSession = values });

                              const eventlogobj = new eventlog(0,'Ondisconnected','Success',reason,AllObj.CSession.session.number,responseObj.key);
                              eventlogRepo.save(eventlogobj);
                          })
                          .catch(error => {
                            const eventlogobj = new eventlog(0,'Ondisconnected','Fail',error,AllObj.CSession.session.number,responseObj.key);
                            eventlogRepo.save(eventlogobj);
                              console.log(error);
                          });
                  }
              });
      
              router.post(`/${responseObj.key}/send`, async function(req, res) {
                  console.log('reqest ', req.body);
                  const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
                  try {
                    
                    const  stat =  await nClient.getState();
                    console.log('state ' , stat);
                    if(stat == 'CONNECTED')
                    {
                        const sentmsg =  await nClient.sendMessage(number, req.body.msg);
                        res.json(sentmsg);  
                      
                    }
                    else
                    {
                        res.json({ message: 'Status changed',value:stat }); 
                    }  
                  }
                  catch(err)
                  {
                      console.log(err);
                      res.json({ message: err.message });  
                  }
                      
              });
              router.post(`/${responseObj.key}/sendfile`, async (req, res) => {
                  console.log('req.body => ', req.body);
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
                          nClient.sendMessage(number, objfile);
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
              router.post(`/${responseObj.key}/sendfileurl`, async (req, res) => {
                  console.log('req.body => ', req.body);
                  const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
                          
              
                  try {
                      if(!req.body.url) {
                          res.send({
                              status: false,
                              message: 'No url found'
                          });
                      } else {
                          //Use the name of the input field (i.e. "avatar") to retrieve the uploaded filere
      
                          axios.get(req.body.url,{
                              responseType: 'arraybuffer'
                          }).then(async resp => {                                        
                              const objfile = new MessageMedia(resp.headers['content-type'],Buffer.from(resp.data, 'binary').toString('base64'),req.body.url.substring(req.body.url.lastIndexOf('/')+1));
                              //console.log(objfile);
                              const sentmsg = await nClient.sendMessage(number, objfile);
                              //console.log('sentmsg ',sentmsg );
                              //send response
                              res.send({
                                  status: true,
                                  message: 'File is uploaded',
                                  data: {
                                      name: req.body.url.substring(req.body.url.lastIndexOf('/')+1),
                                      mimetype: resp.headers['content-type'],
                                      size: resp.headers['content-length'],
                                      id: sentmsg.id
                                  }
                              });
                          });
                          
                          
                      }
                  } catch (err) {
                      res.status(500).send(err);
                  }
              });
      
              router.post(`/${responseObj.key}/sendfiles`, async (req, res) => {
                  console.log('req => ', req.body);
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
                              await nClient.sendMessage(number, objfile);
      
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
      
              router.post(`/${responseObj.key}/disconnect`, async function(req, res) {
                  try {
                      await nClient.logout();
                      await nClient.destroy();
                      let sessionsRepository = connection.getRepository(Sessions);
                      const sesobj = new Sessions(AllObj.CSession.id,AllObj.CSession.session,AllObj.CSession.session.number,responseObj.key,0,value.url,value.licenceKey,value.statusurl);
                      sessionsRepository.save(sesobj).then(values => { AllObj.CSession = values });
                      if (value.statusurl) {
                          axios.post(value.statusurl, { message: 'Status Disconnected',value:'disconnected' })
                              .then(response => {
                                  console.log('REQ URL ',value.url);
                                  console.log('response ',response.data);
                              })
                              .catch(error => {
                                  console.log(error);
                              });
                      }
                  }
                  catch(err)
                  {
                      console.log(err);
                  }
                  res.json({ message: 'You are Disconnected from Whatsapp API.' });   
              });
      
              router.post(`/${responseObj.key}/chatlist`, async function(req, res) {
                  console.log('reqest ', req.body);
                  const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
                  try {
                      const lstchat = await nClient.getChats();
                      res.json (JSON.stringify(lstchat));  
                  }
                  catch(err)
                  {
                      console.log(err);
                      res.json({ message: err.message });  
                  }
                      
              });
      
              router.post(`/${responseObj.key}/contactlist`, async function(req, res) {
                  console.log('reqest ', req.body);
                  try {
                      const lstcontact = await nClient.getContacts();
                      console.log('contacts ', JSON.stringify(lstcontact));
                      res.json (lstcontact);  
                  }
                  catch(err)
                  {
                      console.log(err);
                      res.json({ message: err.message });  
                  }
                      
              });
      
              router.post(`/${responseObj.key}/history`, async function(req, res) {
                  console.log('history reqest ', req.body);
                  try {
                      const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
                      const chat = await nClient.getChatById(number);
                      const messages = await chat.fetchMessages(req.body)
                      
                      res.json (messages);  
                  }
                  catch(err)
                  {
                      console.log(err);
                      res.json({ message: err.message });  
                  }
                      
              });

             });


        });

       

      

        app.get('/api/sessions', function (req, res) {
        
                let sessionsRepository = connection.getRepository(Sessions);
                sessionsRepository.find().then((values) => res.send(values));
        
        });
        app.post('/api/sessions', function (req, res) {
                let sessionsRepository = connection.getRepository(Sessions);
                const sesobj = new Sessions(0,req.body.session,req.body.number,req.body.apikey,1);
                sessionsRepository.save(sesobj).then((values) => res.send(values));
        });

    });

typeorm.createConnection().then(function (connection) {
router.post('/init', async function(req, res) {
    console.log('req =>', req.body);
   
    if (req.body.licenceKey) {
        axios.post('https://www.crmtiger.com/whatsapp/checklifromapi.php?license_key=' +req.body.licenceKey)
            .then(async response => {
                console.log('licenceKey ',req.body.licenceKey);
                console.log('response ',response.data);
                // eslint-disable-next-line no-empty
                if(response.data.message== 'Valid') {
                 //   const newClient = new Client({ puppeteer: {headless: false} });
                    const newClient = new Client({ puppeteer: {args: ['--no-sandbox'],ignoreDefaultArgs: ['--disable-extensions'] } });
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

                        if (req.body.statusurl) {
                            axios.post(req.body.statusurl, { message: 'New QR Generated',value:qr }  )
                                .then(response => {
                                    console.log('REQ URL ',req.body.statusurl);
                                    console.log('response ',response.data);
                                })
                                .catch(error => {
                                    console.log(error);
                                });
                        }
                    });

                    newClient.on('authenticated', async (session) => {
                        console.log('AUTHENTICATED', session);
                        sessionCfg=session;
                        responseObj.number = session.number;
                        responseObj.name = session.name;
                        let sessionsRepository = connection.getRepository(Sessions);
                        await sessionsRepository.delete({ number: session.number }  );
                        
                        const sesobj = new Sessions(0,session,session.number,responseObj.key,1,req.body.url,req.body.licenceKey,req.body.statusurl);
                        
                        await sessionsRepository.save(sesobj).then(values => { AllObj.CSession = values });

                    });

                    newClient.on('auth_failure', msg => {
                        // Fired if session restore was unsuccessfull
                        console.error('AUTHENTICATION FAILURE', msg);
                        if (req.body.statusurl) {
                            axios.post(req.body.statusurl,{ message: 'Authentication Fail',value:msg })
                                .then(response => {
                                    console.log('REQ URL ',req.body.statusurl);
                                    console.log('response ',response.data);
                                    let sessionsRepository = connection.getRepository(Sessions);
                                    const sesobj = new Sessions(AllObj.CSession.id,AllObj.CSession.session,AllObj.CSession.session.number,responseObj.key,0,req.body.url,req.body.licenceKey,req.body.statusurl);
                                    sessionsRepository.save(sesobj).then(values => { AllObj.CSession = values });
                                })
                                .catch(error => {
                                    console.log(error);
                                });
                        }
                    });

                    newClient.on('ready',  () => {
                        console.log('new READY');
                        if (req.body.statusurl) {
                            axios.post(req.body.statusurl, { message: 'Status Connected',value:'Connected' })
                                .then(response => {
                                    console.log('REQ URL ',req.body.statusurl);
                                    console.log('response ',response.data);
                                })
                                .catch(error => {
                                    console.log(error);
                                });
                        }
                    });

                        
                    newClient.on('message', async msg => {
                        console.log('MESSAGE RECEIVED', msg.body);
                        let attachmentData;
                        if(msg.hasMedia)
                        {
                            attachmentData = await msg.downloadMedia();
                            msg.fileData = attachmentData;
                        }
                            
                        console.log('msg = >', msg);
                        // add php api for send msg object  "msg"
                        if (req) {
                            axios.post(req.body.url,msg)
                                .then(response => {
                                    console.log('REQ URL ',req.body.url);
                                    console.log('response ',response.data);
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
                            newClient.sendMessage(msg.from, 'pong');


                        } else if (msg.body.startsWith('!sendto ')) {
                            // Direct send a new message to specific id
                            let number = msg.body.split(' ')[1];
                            let messageIndex = msg.body.indexOf(number) + number.length;
                            let message = msg.body.slice(messageIndex, msg.body.length);
                            number = number.includes('@c.us') ? number : `${number}@c.us`;
                            let chat = await msg.getChat();
                            
                            chat.sendSeen();
                            newClient.sendMessage(number, message);

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
                                await newClient.acceptInvite(inviteCode);
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
                            const chats = await newClient.getChats();
                            newClient.sendMessage(msg.from, `The bot has ${chats.length} chats open.`);
                        } else if (msg.body == '!info') {
                            let info = newClient.info;
                            newClient.sendMessage(msg.from, `
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
                                newClient.sendMessage(msg.from, attachmentData,{ caption: 'Here\'s your requested media.' });
                            }
                        } else if (msg.body == '!location') {
                            msg.reply(new Location(37.422, -122.084, 'Googleplex\nGoogle Headquarters'));
                        } else if (msg.location) {
                            msg.reply(msg.location);
                        } else if (msg.body.startsWith('!status ')) {
                            const newStatus = msg.body.split(' ')[1];
                            await newClient.setStatus(newStatus);
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
                       console.log('before ack =>',msg );
                       console.log('before ack =>',ack );
                        if(ack == 3) {
                            // The message was read
                            console.log('ack =>',msg );
                            const actmsg = { id:msg.id , ack:msg.ack }
                            if (req.body.url) {
                                axios.post(req.body.url,actmsg)
                                    .then(response => {
                                        console.log('REQ URL ',req.body.url);
                                        console.log('actmsg sent ',actmsg );
                                    })
                                    .catch(error => {
                                        console.log(error);
                                    });
                            }

                        }
                    });

                    newClient.on('group_join', (notification) => {
                        // User has joined or been added to the group.
                        console.log('join', notification);
                      //  notification.reply('User joined.');
                    });

                    newClient.on('group_leave', (notification) => {
                        // User has left or been kicked from the group.
                        console.log('leave', notification);
                       // notification.reply('User left.');
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
                    newClient.on('change_state', (state) => {
                        if (req.body.statusurl) {
                            axios.post(req.body.statusurl, { message: 'Status changed',value:state })
                                .then(response => {
                                    console.log('response ',response.data);
                                })
                                .catch(error => {
                                    console.log(error);
                                });
                        }
                        
                        console.log(`State : ${state}`);
                    });
              

                    newClient.on('disconnected', (reason) => {
                        console.log('Client was logged out', reason);
                        if (req.body.statusurl) {
                            axios.post(req.body.statusurl, { message: 'Status Disconnected',value:'disconnected' })
                                .then(response => {
                                    console.log('REQ URL ',req.body.statusurl);
                                    console.log('response ',response.data);
                                    let sessionsRepository = connection.getRepository(Sessions);
                                    const sesobj = new Sessions(AllObj.CSession.id,AllObj.CSession.session,AllObj.CSession.session.number,responseObj.key,0,req.body.url,req.body.licenceKey,req.body.statusurl);
                                    sessionsRepository.save(sesobj).then(values => { AllObj.CSession = values });
                                })
                                .catch(error => {
                                    console.log(error);
                                });
                        }
                    });

                    router.post(`/${responseObj.key}/send`, async function(req, res) {
                        console.log('reqest ', req.body);
                        const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
                        try {
                            const  stat =  await newClient.getState();
                            console.log('state ' , stat);
                            if(stat =='CONNECTED')
                            {
                                const sentmsg =  await newClient.sendMessage(number, req.body.msg);
                                res.json(sentmsg);  
                              
                            }
                            else
                            {
                                res.json({ message: 'Status changed',value:stat }); 
                            }  
                        }
                        catch(err)
                        {
                            console.log(err);
                            res.json({ message: err.message });  
                        }
                            
                    });
                    router.post(`/${responseObj.key}/sendfile`, async (req, res) => {
                        console.log('req.body => ', req.body);
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
                    router.post(`/${responseObj.key}/sendfileurl`, async (req, res) => {
                        console.log('req.body => ', req.body);
                        const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
                                
                    
                        try {
                            if(!req.body.url) {
                                res.send({
                                    status: false,
                                    message: 'No url found'
                                });
                            } else {
                                //Use the name of the input field (i.e. "avatar") to retrieve the uploaded filere

                                axios.get(req.body.url,{
                                    responseType: 'arraybuffer'
                                }).then(async resp => {                                        
                                    const objfile = new MessageMedia(resp.headers['content-type'],Buffer.from(resp.data, 'binary').toString('base64'),req.body.url.substring(req.body.url.lastIndexOf('/')+1));
                                    //console.log(objfile);
                                    const sentmsg = await newClient.sendMessage(number, objfile);
                                    //console.log('sentmsg ',sentmsg );
                                    //send response
                                    res.send({
                                        status: true,
                                        message: 'File is uploaded',
                                        data: {
                                            name: req.body.url.substring(req.body.url.lastIndexOf('/')+1),
                                            mimetype: resp.headers['content-type'],
                                            size: resp.headers['content-length'],
                                            id: sentmsg.id
                                        }
                                    });
                                });
                                
                                
                            }
                        } catch (err) {
                            res.status(500).send(err);
                        }
                    });

                    router.post(`/${responseObj.key}/sendfiles`, async (req, res) => {
                        console.log('req => ', req.body);
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

                    router.post(`/${responseObj.key}/disconnect`, async function(req, res) {
                        try {
                            await newClient.logout();
                            await newClient.destroy();
                            let sessionsRepository = connection.getRepository(Sessions);
                            const sesobj = new Sessions(AllObj.CSession.id,AllObj.CSession.session,AllObj.CSession.session.number,responseObj.key,0,req.body.url,req.body.licenceKey,req.body.statusurl);
                            sessionsRepository.save(sesobj).then(values => { AllObj.CSession = values });
                            if (req.body.statusurl) {
                                axios.post(req.body.statusurl, { message: 'Status Disconnected',value:'disconnected' })
                                    .then(response => {
                                        console.log('REQ URL ',req.body.url);
                                        console.log('response ',response.data);
                                    })
                                    .catch(error => {
                                        console.log(error);
                                    });
                            }
                        }
                        catch(err)
                        {
                            console.log(err);
                        }
                        res.json({ message: 'You are Disconnected from Whatsapp API.' });   
                    });

                    router.post(`/${responseObj.key}/chatlist`, async function(req, res) {
                        console.log('reqest ', req.body);
                        const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
                        try {
                            const lstchat = await newClient.getChats();
                            res.json (JSON.stringify(lstchat));  
                        }
                        catch(err)
                        {
                            console.log(err);
                            res.json({ message: err.message });  
                        }
                            
                    });

                    router.post(`/${responseObj.key}/contactlist`, async function(req, res) {
                        console.log('reqest ', req.body);
                        try {
                            const lstcontact = await newClient.getContacts();
                            console.log('contacts ', JSON.stringify(lstcontact));
                            res.json (lstcontact);  
                        }
                        catch(err)
                        {
                            console.log(err);
                            res.json({ message: err.message });  
                        }
                            
                    });

                    router.post(`/${responseObj.key}/history`, async function(req, res) {
                        console.log('history reqest ', req.body);
                        try {
                            const number = req.body.number.includes('@c.us') ? req.body.number : `${req.body.number}@c.us`;
                            const chat = await newClient.getChatById(number);
                            const messages = await chat.fetchMessages(req.body)
                            res.json (messages);  
                        }
                        catch(err)
                        {
                            console.log(err);
                            res.json({ message: err.message });  
                        }
                            
                    });

                    responseObj.qr= newClient.test;
                    res.json(responseObj);  
                }
                else {
                    res.json({ message: 'LicenceKey is not Valid.' });  
                }
            })
            .catch(error => {
                console.log(error);
            });
    }
    else
    {
        res.json({ message: 'LicenceKey not provided' }); 
    }
    
    
});
});