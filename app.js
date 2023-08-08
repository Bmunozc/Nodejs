
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mysql = require('mysql');

const app = express();
const SECRET_KEY = 'tu_clave_secreta_aqui';

app.use(cors());
app.use(bodyParser.json());


const dbConfig = {
  host: process.env.DB_HOST || '2.tcp.ngrok.io',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bd2',
  port: process.env.DB_PORT || 10085, // Cambia 1143941782 por el número de puerto de la base de datos que desees.
};
const connection = mysql.createConnection(dbConfig);
connection.connect((err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
  } else {
    console.log('Conexión exitosa a la base de datos');
  }
});



app.get('/api/consultadeSolicitudes', (req, res) => {
  const idEstudiante = req.params.id_estudiante; // Obtener el id_estudiante del parámetro de la URL
  const query = 'SELECT * FROM solicitudes'; // Filtrar por id_estudiante
  connection.query(query, [idEstudiante], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    // Si no hay errores, envía los resultados como respuesta al cliente
    res.json(results);
  });
});

app.get('/api/consultaSolicitud/:id_estudiante', (req, res) => {
  const idEstudiante = req.params.id_estudiante; // Obtener el id_estudiante del parámetro de la URL
  const query = 'SELECT * FROM solicitudes WHERE id_estudiante = ?'; // Filtrar por id_estudiante
  connection.query(query, [idEstudiante], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    // Si no hay errores, envía los resultados como respuesta al cliente
    res.json(results);
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // Consulta en la base de datos para verificar las credenciales y obtener el id_rol del usuario
  const query = 'SELECT id,rol,nombre,email, semestre, carrera FROM usuarios WHERE email = ? AND password = ?';
  connection.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

  
    if (results.length === 1) {
      // Credenciales válidas, obtiene los datos del usuario de la consulta
      const {id,rol, nombre,email, semestre, carrera } = results[0];

      // Consulta en la tabla "roles" para obtener el nombre del rol usando el id_rol obtenido
      const roleQuery = 'SELECT nombre FROM roles WHERE id = ?';
      connection.query(roleQuery, [rol], (err, roleResults) => {
        if (err) {
          console.error('Error en la consulta a la base de datos:', err);
          return res.status(500).json({ error: 'Error en el servidor' });
        }

        if (roleResults.length === 1) {
          // Obtiene el nombre del rol desde la consulta a la tabla "roles"
          const { nombre: nombreRol } = roleResults[0];

          // Genera el token JWT para el usuario y agrega los datos del usuario a la carga útil
          const token = generateToken(email, nombreRol);

          // Devuelve el token y los datos del usuario como parte de la respuesta al cliente
          return res.json({ token, id, rol: nombreRol, nombre, email, semestre, carrera });
        } else {
          // Rol no encontrado en la tabla "roles"
          return res.status(500).json({ error: 'Error en el servidor' });
        }
      });
    } else {
      // Credenciales inválidas
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
  });
});




  // Middleware para verificar el token JWT en las rutas protegidas
  function generateToken(email, rol) {
    const payload = { email, rol };
    const options = { expiresIn: '1h' }; // El token expirará en 1 hora, puedes ajustar el tiempo según tus necesidades
    const token = jwt.sign(payload, SECRET_KEY, options);
    return token;
  }
  
// REGISTRO

app.post('/api/register', (req, res) => {
  const { nombre, email, password, rol, carrera, semestre } = req.body;

  // Consulta en la base de datos para verificar si el email ya está registrado
  const queryCheckEmail = 'SELECT * FROM usuarios WHERE email = ?';
  connection.query(queryCheckEmail, [email], (err, results) => {
    if (err) {
      console.error('Error al verificar el email en la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    // Si el email ya está registrado, envía una respuesta indicando que el usuario no puede ser registrado nuevamente
    if (results.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    // Si el email no está registrado, procede con el registro del usuario en la base de datos
    const queryRegisterUser = 'INSERT INTO usuarios (nombre, email, password, rol, carrera, semestre) VALUES (?, ?, ?, ?, ?, ?)';
    connection.query(queryRegisterUser, [nombre, email, password, rol, carrera, semestre], (err, results) => {
      if (err) {
        console.error('Error al guardar el usuario:', err);
        return res.status(500).json({ error: 'Error en el servidor' });
      }

      // Genera el token JWT para el usuario registrado
      const token = generateToken(email, rol);

      // Devuelve el token como parte de la respuesta al cliente
      return res.json({ message: 'Registro exitoso', token });
    });
  });
});

/**function verifyToken(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }

  // El token es válido, extrae la información del usuario del token y agrega el objeto 'usuario' al request
    req.usuario = decoded;
    next();
  });
}*/





function verifyToken(req, res, next) {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado. No autorizado.' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      // Si hay un error en la verificación, el token es inválido
      return res.status(401).json({ error: 'Token inválido' });
    }

    // El token es válido, extrae la información del usuario del token y agrega el objeto 'usuario' al request
    req.usuario = decoded;
    next();
  });
}



app.get('/api/user', verifyToken, (req, res) => {
  // En este punto, el token ya ha sido verificado y la información del usuario se encuentra en req.usuario
  // Puedes utilizar req.usuario para obtener el email y el rol del usuario y responder con los datos del usuario
  const { email, rol } = req.usuario;
  
  // Realiza la consulta a la base de datos para obtener los datos del usuario según el email y el rol
  const query = 'SELECT * FROM usuarios WHERE email = ? AND rol = ?';
  connection.query(query, [email, rol], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (results.length === 1) {
      // Usuario encontrado, devuelve los datos del usuario
      const usuario = results[0];
      return res.json(usuario);
    } else {
      // Usuario no encontrado o datos inconsistentes, devuelve un error
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
  });
});


// Ruta para editar una solicitud
app.put('/api/editarSolicitud/:id', (req, res) => {
  const idSolicitudParam = req.params.id;


  // Verificar que el id_estudiante del token coincida con el id_estudiante del usuario que hizo la solicitud
  const getSolicitudQuery = 'SELECT id_estudiante FROM solicitudes WHERE id = ?';
  connection.query(getSolicitudQuery, [idSolicitudParam], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    const { nombre, motivo, semestre } = req.body;

    // Validar que los campos no estén vacíos
    if (!nombre || !motivo || !semestre) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Actualizar los datos de la solicitud en la base de datos
    const updateSolicitudQuery = 'UPDATE solicitudes SET nombre = ?, motivo = ?, semestre = ? WHERE id = ?';
    connection.query(updateSolicitudQuery, [nombre, motivo, semestre, idSolicitudParam], (err, results) => {
      if (err) {
        console.error('Error en la consulta a la base de datos:', err);
        return res.status(500).json({ error: 'Error en el servidor' });
      }

      // Verificar si se actualizó algún registro
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'No se encontró la solicitud con el id proporcionado' });
      }

      // Devolver una respuesta de éxito al cliente
      res.json({ message: 'Solicitud actualizada exitosamente' });
    });
  });
});

//
app.post('/api/insertRespuestas/:id', (req, res) => {
  const idSolicitudParam = req.params.id;
  const { respuesta, estado } = req.body;

  // Obtén el ID de la solicitud desde el parámetro de la ruta
  const consulta_id = idSolicitudParam;

  // Verificar que el ID de la solicitud esté presente
  if (!consulta_id) {
    return res.status(400).json({ error: 'ID de la solicitud no proporcionado en la ruta' });
  }

  // Realiza una consulta para obtener el ID del estudiante y luego realizar la inserción
  const getStudentIdQuery = 'SELECT id_estudiante FROM solicitudes WHERE id = ?';

  connection.query(getStudentIdQuery, [consulta_id], (err, results) => {
    if (err) {
      console.error('Error al obtener el ID del estudiante:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const id_estudiante = results[0].id_estudiante;

    // Realiza la inserción en la tabla "consulta" con el ID del estudiante
    const insertQuery = 'INSERT INTO consulta (respuesta, estado, consulta_id, id_estudiante) VALUES (?, ?, ?, ?)';
    connection.query(insertQuery, [respuesta, estado, consulta_id, id_estudiante], (err, results) => {
      if (err) {
        console.error('Error al insertar la solicitud en la base de datos:', err);
        return res.status(500).json({ error: 'Error en el servidor' });
      }

      return res.json({ message: 'Solicitud insertada exitosamente' });
    });
  });
});






//REGISTRAR
// index.js (o tu archivo principal del backend)
// Resto del código...
app.post('/api/solicitudes', (req, res) => {
  const { nombre, motivo, fecha, semestre, id_estudiante} = req.body;

  // Realiza la inserción en la tabla "solicitudes"
  const query = 'INSERT INTO solicitudes (nombre, motivo, estado, fecha, semestre,id_estudiante) VALUES (?, ?, ?, ?,?,?)';
  connection.query(query, [nombre, motivo, fecha, semestre,id_estudiante], (err, results) => {
    if (err) {
      console.error('Error al insertar la solicitud en la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    return res.json({ message: 'Solicitud insertada exitosamente' });
  });
});

// Resto del código...
// Backend
app.get('/api/consultaSolicitud/:id', (req, res) => {
  const idEstudiante = req.params.id;

  // Realiza una consulta para obtener el estado de la tabla "consulta" basado en el id_estudiante
  const query = `
    SELECT estado 
    FROM consulta
    LEFT JOIN consulta c ON s.id = c.consulta_id
    WHERE s.id_estudiante = ?
  `;

  connection.query(query, [idEstudiante], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    // Si no hay errores, envía los resultados como respuesta al cliente
    res.json(results);
  });
});


app.get('/api/consultaSolicitud1/:id', (req, res) => {
  const idSolicitudParam = req.query.id; // Obtener el id de solicitud desde el parámetro de consulta

  const getSolicitudQuery = 'SELECT * FROM solicitudes WHERE id = ?';
  connection.query(getSolicitudQuery, [idSolicitudParam], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'No se encontró la solicitud con el id proporcionado' });
    }

    const solicitud = results[0];

    // Devolver la solicitud encontrada como respuesta
    res.json(solicitud);
  });
});

app.put('/api/consultaSolicitud/', (req, res) => {
  const { id, respuesta, estado, consulta_id } = req.body;

  // Actualizar los datos de la consulta en la base de datos
  const updateConsultaQuery = 'UPDATE consultas SET respuesta = ?, estado = ? WHERE consulta_id = ?';
  connection.query(updateConsultaQuery, [respuesta, estado, consulta_id], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    // Verificar si se actualizó algún registro
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'No se encontró la consulta con el id proporcionado' });
    }

    // Devolver una respuesta de éxito al cliente
    res.json({ message: 'Consulta actualizada exitosamente' });
  });
});

app.get('/api/consultaEstados/:id/:otro_id', (req, res) => {
  const consultaId = req.params.id;
  const otroId = req.params.otro_id;

  const getConsultaQuery = 'SELECT id, estado FROM consulta WHERE consulta_id = ? AND id_estudiante = ?';

  connection.query(getConsultaQuery, [consultaId, otroId], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'No se encontró la consulta con los ids proporcionados' });
    }

    // Devolver la consulta encontrada como respuesta
    res.json(results[0]);
  });
});








app.post('/api/refresh-token', (req, res) => {
  // Obten el token actual de la cabecera "Authorization"
  const authHeader = req.headers['authorization'];
  const currentToken = authHeader ? authHeader.split(' ')[1] : null;

  if (!currentToken) {
    return res.status(401).json({ error: 'Token no proporcionado. No autorizado.' });
  }

  // Verificar el token actual para asegurarnos de que sea válido
  jwt.verify(currentToken, SECRET_KEY, (err, decodedToken) => {
    if (err) {
      // Si el token actual no es válido, retornamos un error.
      return res.status(401).json({ error: 'Token no válido. No autorizado.' });
    }

    // Si el token es válido, generamos un nuevo token con la información del usuario.
    const payload = { userId: decodedToken.userId, username: decodedToken.username };
    const newToken = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

    // Devolvemos el nuevo token como respuesta.
    return res.json({ token: newToken });
  });
});

app.get('/api/consulta/:consultaId/solicitud', (req, res) => {
  const consultaId = parseInt(req.params.id);

  // Realiza la consulta en la base de datos para obtener las solicitudes relacionadas con la consulta
  const query = 'SELECT * FROM consulta WHERE id = ?';
  connection.query(query, [consultaId], (err, results) => {
    if (err) {
      console.error('Error en la consulta a la base de datos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    // Si no hay errores, envía los resultados como respuesta al cliente
    res.json(results);
  });
});

  
// Resto del código...
// index.js

require('dotenv').config();
const PORT = process.env.PORT || 3000;


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));