const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const fsPromises = require('fs/promises');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const index = path.join(__dirname, 'index.html');
const main = path.join(__dirname, 'main.html');
const filmy = path.join(__dirname, 'filmy.html');
const seriale = path.join(__dirname, 'seriale.html');
const konto = path.join(__dirname, 'konto.html');
const admin = path.join(__dirname, 'admin.html')
const app = express();
const port = 3000;


// Połączenie z bazą danych MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'websitefilms',
});

db.connect((err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err);
  } else {
    console.log('Połączono z bazą danych MySQL');
  }
});

// Ustawienia sesji 
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Parsowanie ciała żądania
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware sprawdzający, czy użytkownik jest zalogowany
const checkAuthentication = (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/'); // Przekieruj do strony logowania, jeśli nie jest zalogowany
    }
    next();
  };
  
  // Middleware sprawdzający, czy użytkownik ma rolę admina
  const checkAdminRole = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
      return next(); // Użytkownik ma rolę admina, kontynuuj
    }
    res.send('Brak uprawnień administratora');
  };
  
  // Middleware sprawdzający, czy użytkownik ma rolę moderatora
  const checkModeratorRole = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'moderator')) {
      return next(); // Użytkownik ma rolę admina lub moderatora, kontynuuj
    }
    res.send('Brak uprawnień moderatora');
  };

app.use('/zdjecia', checkAuthentication, express.static('zdjecia'));
app.use('/filmy', checkAuthentication, express.static('filmy'));

app.get('/', (req, res) => {
  res.sendFile(index);
});

// Obsługa logowania
app.post('/login', (req, res) => {
    const { username, password } = req.body;
  
    // Weryfikacja użytkownika w bazie danych
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
      if (err) {
        console.error('Błąd podczas weryfikacji użytkownika:', err);
        res.send('Błąd podczas weryfikacji użytkownika');
        return;
      }
  
      // Sprawdzenie, czy użytkownik istnieje
      if (results.length > 0) {
        const user = results[0];
  
        // Ustawienie sesji dla zalogowanego użytkownika
        req.session.user = {
          id: user.id,
          username: user.username,
          role: user.role,
        };
        console.log('Ustawiono sesję dla użytkownika:', req.session.user.id);

        res.redirect('/main');
      } else {
        res.send('Błędne dane logowania');
      }
    });
  });


// Strona panelu użytkownika (glowna strona po zalogowaniu)
app.get('/main', checkAuthentication, (req, res) => {
  res.sendFile(main);
});

//zmienia strone filmy na bez .html
app.get('/filmy.html', checkAuthentication, (req, res) => {
  res.redirect('/filmy');
});


//strona zakladka filmy 
app.get('/filmy', checkAuthentication, (req, res) => {
    // Pobierz informacje o filmach z bazy danych
    db.query('SELECT * FROM files', (err, results) => {
        if (err) {
            console.error('Błąd podczas pobierania informacji o filmach:', err);
            res.send('Błąd podczas pobierania informacji o filmach');
            return;
        }
        const movieList = results.map(movie => ({
            id: movie.id,
            title: movie.title,
            image: `/zdjecia/${movie.image_name}`,  // Dodaj bazową ścieżkę do obrazów
            video: `/${movie.video_name}`,  // Dodaj bazową ścieżkę do filmów
          }));
          const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Filmy</title>
            </head>
            <body>
                <h1>Lista Filmów</h1>
                
                <ul>
                  ${movieList.map(movie => `
                    <li>
                      <img src="${movie.image}" alt="${movie.title}">
                      <a href="${movie.id}">${movie.title}</a>
                    </li>
                  `).join('')}
                </ul>
            </body>
            </html>
          `;
    res.send(htmlContent);
    }
  );
});

// Strona z informacjami o konkretnym filmie po id z bazdy danych
app.get('/filmy/:id', checkAuthentication, (req, res) => {
    const movieId = req.params.id;
  
    // Pobierz informacje o konkretnym filmie z bazy danych
    db.query('SELECT * FROM files WHERE id = ?', [movieId], (err, results) => {
      if (err) {
        console.error('Błąd podczas pobierania informacji o filmie:', err);
        res.send('Błąd podczas pobierania informacji o filmie');
        return;
      }
  
      if (results.length === 0) {
        res.send('Film nie został znaleziony');
        return;
      }
  
      // Renderuj stronę HTML z szczegółami filmu
      const movieDetails = {
        title: results[0].title,
        video: `/filmy/${results[0].video_name}`,

      };
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Film</title>
        </head>
        <body>            
            <div>
                <h2>${movieDetails.title}</h2>
                <video controls autoplay width="640" height="360">
                <source src="${movieDetails.video}" type="video/mp4">
                </video>
            </div>
            <a href="/filmy">Powrót do listy filmów</a>
        </body>
        </html>
      `;
  
      res.send(htmlContent);
    });
  });

    app.get('/seriale.html', checkAuthentication, (req, res) => {
        res.redirect('/seriale');
      });

    //opcja dla seriali za niedlugo
    app.get('/seriale', checkAuthentication, (req, res) => {
        res.sendFile(seriale);
    });
  
    app.get('/konto.html', checkAuthentication, (req, res) => {
        res.redirect('/konto');
    });
    app.get('/konto', checkAuthentication, (req, res) => {
        res.sendFile(konto);
      });


    app.get('/admin.html', checkAuthentication, checkAdminRole, (req, res) => {
        res.redirect('/admin')

    });
    app.get('/admin', checkAuthentication, checkAdminRole, (req, res) => {
        res.sendFile(admin);
    });
 
    
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const folder = file.fieldname === 'image' ? 'zdjecia' : 'filmy';
            const uploadPath = path.join(__dirname, folder);
    
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath);
            }
    
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            let nameField; 
            
            if (req.body.videoName) {
                nameField = req.body.videoName; 
            } else if (req.body.imageName) {
                nameField = req.body.imageName; 
            } 
        
            const ext = path.extname(file.originalname);
            const fileName = nameField + ext;
        
            cb(null, fileName);
        }
    });

const upload = multer({ storage: storage });

app.post('/admin', checkAuthentication, checkAdminRole, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), (req, res) => {
  const title = req.body.title;
  const imageName = path.basename(req.files.image[0].path);
  const videoName = path.basename(req.files.video[0].path);
  const videoPath = 'C:\\xampp\\htdocs\\WitrynaNaSerwer\\filmy\\' + videoName;

  saveFileInfo(req.session.user.id, title, imageName, videoName);   //zapis do bazy danych 
  initiateConversionInBackground(req.session.user.id, title, videoPath);   // Inicjuj konwersję w tle
  console.log('Plik został dodany do bazy danych. Proszę czekać na konwersję.');   // Odpowiedz użytkownikowi, że plik został dodany do bazy danych
});
function saveFileInfo(userId, title, imageName, videoName) {
  db.query('INSERT INTO files (user_id, title, image_name, video_name) VALUES (?, ?, ?, ?)', [userId, title, imageName, videoName], (err, results) => {
    if (err) {
      console.error('Błąd podczas zapisywania informacji o pliku:', err);
    } else {
      console.log('Informacje o pliku zostały zapisane w bazie danych.');
    }
  });
}


function initiateConversionInBackground(userId, title, videoPath) {
  if (!videoPath.toLowerCase().endsWith('.mkv')) {
    console.log('Plik nie jest w formacie .mkv, konwersja nie zostanie uruchomiona.');
    return;
  }
  const spawn = require('child_process').spawn;
  const conversionProcess = spawn('node', ['convertbackground.js', userId, title, videoPath]);
  conversionProcess.on('close', (code) => {
    console.log(`Proces konwersji zakończony z kodem: ${code}`);
  });
  conversionProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });
  conversionProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
  conversionProcess.on('error', (error) => {
    console.error(`Błąd podczas uruchamiania procesu konwersji: ${error.message}`);
  });
  conversionProcess.stdout.on('data', (data) => {
    const message = data.toString();
    if (message.startsWith('PROGRESS:')) {
      const progress = message.split(':')[1].trim();
      console.log('Postęp konwersji:', progress);
    } else {
      console.log(`stdout: ${data}`);
    }
  });
}

app.listen(port, () => {
  console.log(`Aplikacja działa na http://localhost:${port}`);
});

