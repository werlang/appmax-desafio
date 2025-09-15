import express from 'express';
import cors from 'cors';
import ServiceRouter from './helpers/service-router.js';
import registerControllers from './controller.js';

registerControllers();

const port = 3000;
const host = '0.0.0.0';

const app = express();

app.use(express.urlencoded({ extended: true, limit: '1024kb'}));
app.use(express.json({ limit: '1024kb' }));
app.use(cors());

app.get('/ready', (req, res) => {
    res.status(200).send({ message: 'I am ready!' });
});

app.post('/email', (req, res) => {
    const service = new ServiceRouter('email', req.body);
    res.send({ status: 'in queue', position: service.getPosition(), id: service.getId() });
});

app.post('/telegram', (req, res) => {
    const service = new ServiceRouter('telegram', req.body);
    res.send({ status: 'in queue', position: service.getPosition(), id: service.getId() });
});

app.post('/sms', (req, res) => {
    const service = new ServiceRouter('sms', req.body);
    res.send({ status: 'in queue', position: service.getPosition(), id: service.getId() });
});

app.get('/service/:id', async (req, res) => {
    const service = await ServiceRouter.getService(req.params.id);
    if (!service) {
        return res.status(404).send({ message: 'Service not found.' });
    }
    
    res.send(service);
});

// 404
app.use((req, res) => {
    res.status(404).send({ message: 'I am sorry, but I think you are lost.' });
});

app.listen(port, host, () => {
    console.log(`Web Server running at http://${host}:${port}/`);
});

export default app;