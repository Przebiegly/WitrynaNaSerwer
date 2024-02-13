const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const mysql = require('mysql');

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

function updateFileNameInDatabase(userId, title, newFileName) {
  db.query('UPDATE files SET video_name = ? WHERE user_id = ? AND title = ?', [newFileName, userId, title], (err, results) => {
    if (err) {
      console.error('Błąd podczas aktualizacji nazwy pliku:', err);
    } else {
      console.log('Nazwa pliku została zaktualizowana w bazie danych.');
    }
  });
}

function konwertujVideo(userId, title, videoPath) {
  const newFileName = path.parse(videoPath).name + '.mp4';
  const sciezkaSkonwertowanegoVideo = 'C:\\xampp\\htdocs\\WitrynaNaSerwer\\filmy\\' + newFileName;

  ffmpeg()
    .input(videoPath)
    .output(sciezkaSkonwertowanegoVideo)
    .outputOptions([
      '-c:v copy',  //obrazz
      '-c:a aac',  //audio 
      '-strict experimental'
    ])
    .on('end', () => {
      console.log('Konwersja wideo zakończona.');
      updateFileNameInDatabase(userId, title, newFileName);
    })
    .on('error', (err, stdout, stderr) => {
      console.error('Błąd podczas konwersji wideo:', err);
      console.log('Standardowe wyjście (stdout):', stdout);
      console.log('Standardowe błędy (stderr):', stderr);
    })
    .on('progress', (progress) => {
      console.log('PROGRESS:', progress.percent);
        })
    .run();
}

if (require.main === module) {
  const userId = process.argv[2];
  const title = process.argv[3];
  const videoPath = process.argv[4];

  konwertujVideo(userId, title, videoPath);
}