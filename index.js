import express from 'express';
import morgan from 'morgan';
import http from 'http';

import userRoute from './routes/user.route.js'
import roleRoute from './routes/role.router.js'

const app = express();
app.use(express.json());
app.use(morgan('dev'));

app.use('/Users', userRoute);
app.use('/Roles', roleRoute);

app.get('/', (req,res) => {
    res.send('Hello World');
});

const PORT = process.env.PORT || 3030;
const server = http.createServer(app);
server.listen(PORT, () => {
    console.log(`Internet Banking API listening on port ${PORT}`);
});