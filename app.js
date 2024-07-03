const express = require('express');
const app = express();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieparser = require('cookie-parser');
const db = require('./config/dbconn');

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieparser());

app.get("/", (req, res, next) => {
    res.cookie("token", "");
    res.render("index");
});


app.post("/createuser", async (req, res, next) => {
    let { username, fullName, password, age } = req.body;
    username = username.trim();
    fullName = fullName.trim();
    password = password.trim();
    
    try {
        const [euser] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (euser.length > 0) {
            res.redirect("/login");
        } else {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            await db.query('INSERT INTO users (username, fullName, password, age) VALUES (?, ?, ?, ?)', [username, fullName, hash, age]);
            res.redirect("/login");
        }
    } catch (err) {
        console.error('Error in createuser:', err);
        return next(new Error("Internal Error"));
    }
});


app.get("/login", (req, res, next) => {
    res.cookie("token", "");
    res.render("login");
});

app.post("/userlogin", async (req, res, next) => {
    let { username, password } = req.body;
    username = username.trim();
    password = password.trim();
    
    const [fuser] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (fuser.length === 0) {
        res.redirect("/");
    } else {
        bcrypt.compare(password, fuser[0].password, (err, result) => {
            if (err) return next(new Error("Internal Error"));
            if (result) {
                let token = jwt.sign({ username, uid: fuser[0].id }, "secret");
                res.cookie("token", token);
                res.redirect("/profile");
            } else {
                res.redirect("/login");
            }
        });
    }
});

app.get("/profile", isLoggedIn, async (req, res, next) => {
    const [conf] = await db.query('SELECT * FROM conferences');
    const [user] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.uid]);
    const [feed] = await db.query('SELECT * FROM feedback WHERE attender = ?', [req.user.uid]);
    const [feed2] = await db.query('SELECT * FROM feedback');
    let count = feed.length;
    let flag = false;
    res.render("profile", { conf, user: user[0], feed, flag, feed2, cn: user[0].registered ? user[0].registered.split(',').length : 0, count });
});

app.get("/register/:id", isLoggedIn, async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const confId = req.params.id;

        
        const [user] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const [conf] = await db.query('SELECT * FROM conferences WHERE id = ?', [confId]);

        
        if (user.length === 0 || conf.length === 0) {
            return res.status(404).send("User or Conference not found");
        }

        
        const attendeesList = conf[0].attendees ? conf[0].attendees.split(',') : [];
        const userIndex = attendeesList.indexOf(userId.toString());

        if (userIndex == -1) {
            attendeesList.push(userId.toString());
        } else {
            attendeesList.splice(userIndex, 1);
        }

        
        await db.query('UPDATE conferences SET attendees = ? WHERE id = ?', [attendeesList.join(','), confId]);

        
        const registeredConfs = user[0].registered ? user[0].registered.split(',') : [];
        const confIndex = registeredConfs.indexOf(confId.toString());

        if (confIndex === -1) {
            registeredConfs.push(confId.toString());
        } else {
            registeredConfs.splice(confIndex, 1);
        }

        await db.query('UPDATE users SET registered = ? WHERE id = ?', [registeredConfs.join(','), userId]);

        res.redirect("/profile");
    } catch (err) {
        console.error("Error in register route:", err);
        next(err); 
    }
});

app.get("/feedback/:id",isLoggedIn, async (req, res, next) => {
    try {
        const confId = req.params.id;
        
        
        const [conf] = await db.query('SELECT * FROM conferences WHERE id = ?', [confId]);

       
        if (!conf || conf.length === 0) {
            return res.status(404).send("Conference not found");
        }

        
        res.render("feedback", { conf: conf[0] });
    } catch (err) {
        console.error("Error in feedback route:", err);
        next(err); 
    }
});


app.post("/feedback/:id", isLoggedIn, async (req, res, next) => {
    try {
        const [user] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.uid]);
        const [conf] = await db.query('SELECT * FROM conferences WHERE id = ?', [req.params.id]);
        let { content } = req.body;
        content = content.trim();
        
      
        const [feed] = await db.query('INSERT INTO feedback (attender, forConf, content) VALUES (?, ?, ?)', [user[0].id, conf[0].id, content]);
        
        conf[0].feedback += `,${feed.insertId}`;
        await db.query('UPDATE conferences SET feedback = ? WHERE id = ?', [conf[0].feedback, req.params.id]);
        
     
        res.redirect("/profile");
    } catch (err) {
        console.error("Error in feedback submission:", err);
        next(err); 
        
    }
});

app.post('/submit-feedback', (req, res) => {
    const { id, feedback } = req.body; 
    
      if (id && feedback) {
      
        db.collection('feedbacks').insertOne({ id, feedback })
            .then(() => {
                res.status(200).json({ message: 'Feedback submitted successfully' });
            })
            .catch((error) => {
                console.error('Error saving feedback:', error);
                res.status(500).json({ error: 'Internal server error' });
            });
    } else {
        res.status(400).json({ error: 'Bad request: Missing required fields' });
    }
});


// app.post("/feedback/:id", isLoggedIn, async (req, res, next) => {
//     const [user] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.uid]);
//     const [conf] = await db.query('SELECT * FROM conferences WHERE id = ?', [req.params.id]);
//     let { content } = req.body;
//     content = content.trim();
//     const [feed] = await db.query('INSERT INTO feedback (attender, forConf, content) VALUES (?, ?, ?)', [user[0].id, conf[0].id, content]);
//     conf[0].feedback += `,${feed.insertId}`;
//     await db.query('UPDATE conferences SET feedback = ? WHERE id = ?', [conf[0].feedback, req.params.id]);
//     res.redirect("/profile");
// });

app.get("/createadmin", async (req, res, next) => {
    res.cookie("token", "");
    const [exist] = await db.query('SELECT * FROM admin');
    if (exist.length < 0) {
        res.send("Already exists an admin");
    } else {
        res.render("createadmin");
    }
});

app.post("/createadmin", (req, res, next) => {
    let { name, password } = req.body;
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            await db.query('INSERT INTO admin (name, password) VALUES (?, ?)', [name, hash]);
            res.redirect("/adminlogin");
        });
    });
});

app.get("/adminlogin", (req, res, next) => {
    res.cookie("token", "");
    res.render("adminlogin");
});

app.post("/adminlogin", async (req, res, next) => {
    let { name, password } = req.body;
    const [adm] = await db.query('SELECT * FROM admin WHERE name = ?', [name]);
    if (adm.length > 0) {
        bcrypt.compare(password, adm[0].password, (err, result) => {
            if (result) {
                let token = jwt.sign({ name, aid: adm[0].id }, "secret");
                res.cookie("token", token);
                res.redirect("/adminpanel");
            } else {
                res.redirect("/adminlogin");
            }


        });
    } else {
        res.redirect("/adminlogin");
    }
});


app.get("/adminpanel", isLoggedIn, async (req, res, next) => {
    const [adm] = await db.query('SELECT * FROM admin WHERE id = ?', [req.user.aid]);
    if (adm.length > 0) {
        const [conf] = await db.query('SELECT * FROM conferences');
        let count = conf.reduce((acc, c) => acc + c.attendees.split(',').length, 0);
        const [feed] = await db.query('SELECT * FROM feedback');
        res.render("adminpanel", { adm: adm[0], conf, count, feeds: feed.length });
    } else {
        res.redirect("/login"); 
    }
});


app.post("/createconf", isLoggedIn, async (req, res, next) => {
    const [adm] = await db.query('SELECT * FROM admin WHERE id = ?', [req.user.aid]);
    if (adm.length > 0) {
        let { title, date } = req.body;
        await db.query('INSERT INTO conferences (title, date) VALUES (?, ?)', [title, date]);
        res.redirect("/adminpanel");
    } else {
        res.redirect("/login");
    }
});

app.get("/delete/:id", isLoggedIn, async (req, res, next) => {
    const [adm] = await db.query('SELECT * FROM admin WHERE id = ?', [req.user.aid]);
    if (adm.length > 0) {
        const [dconf] = await db.query('SELECT * FROM conferences WHERE id = ?', [req.params.id]);
        const feedbackIds = dconf[0].feedback.split(',');
        for (const feedId of feedbackIds) {
            await db.query('DELETE FROM feedback WHERE id = ?', [feedId]);
        }
        const [users] = await db.query('SELECT * FROM users');
        for (const user of users) {
            const registered = user.registered.split(',');
            const index = registered.indexOf(dconf[0].id.toString());
            if (index !== -1) {
                registered.splice(index, 1);
                await db.query('UPDATE users SET registered = ? WHERE id = ?', [registered.join(','), user.id]);
            }
        }
        await db.query('DELETE FROM conferences WHERE id = ?', [dconf[0].id]);
        res.redirect("/adminpanel");
    } else {
        res.redirect("/login");
    }
});

app.get("/viewfeed", isLoggedIn, async (req, res, next) => {
    try {
       
        const [adm] = await db.query('SELECT * FROM admin WHERE id = ?', [req.user.aid]);
        
    
        if (adm.length > 0) {
            
            const [feeds] = await db.query('SELECT * FROM feedback');
          
            
              res.render("feeds", { feeds, adm: adm[0] });
        } else {
             throw new Error('Admin not found');
        }
    } catch (error) {
        console.error('Error fetching data:', error.message);
        res.status(500).send('Internal Server Error');
    }
});


app.get("/error", (req, res, next) => {
    return next(new Error("hi I am error"));
});

function isLoggedIn(req, res, next) {
    if (req.cookies.token === "") res.redirect("/login");
    else {
        let data = jwt.verify(req.cookies.token, "secret");
        if (data) {
            req.user = data;
            next();
        } else {
            res.redirect("/login");
        }
    }
}

app.use((err, req, res, next) => {
    console.log(err.stack);
    res.render("error", { err: err.message });
});

app.listen(3000);
