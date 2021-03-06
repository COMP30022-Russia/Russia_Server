import http, { Server } from 'http';

// Set environment variables and initialise app
import './server_load_env';
import app from './app';

// Initialise database
import models from './models';

// socket.io imports
import socket from 'socket.io';
import io from './socket';

// Get and set provided port
const port: string = process.env.PORT || '3000';
app.set('port', port);

// Create HTTP server
const server: Server = http.createServer(app);

// Connect to database, sync tables and start server
export default (async () => {
    try {
        // Get database information
        const dbPort = models.sequelize.config.port;
        const dbHost = models.sequelize.config.host;

        // Test connection by trying to authenticate
        await models.sequelize.authenticate();
        console.info(`Database running on port ${dbPort} of host ${dbHost}`);

        // Sync defined models
        await models.sequelize.sync();

        // Set up socket.io
        io(socket(server));

        // Create listener on port
        await server.listen(port);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();

// Event listener for HTTP server "listening" event
server.on('listening', () => {
    const addr = server.address();
    const bind =
        typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
    console.info(`Express listening on ${bind} in ${app.get('env')} mode`);
});

// Event listener for HTTP server "error" event
// istanbul ignore next
server.on('error', (err: any) => {
    if (err.syscall !== 'listen') {
        throw err;
    }
    const bind = `Port ${port}`;

    // Handle specific errors with friendly messages
    switch (err.code) {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw err;
    }
});

export const sequelize = models.sequelize;
export { app };
