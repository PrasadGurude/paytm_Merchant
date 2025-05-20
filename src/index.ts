import express from 'express';
import cors from 'cors';
import userRoutes from './routes/user';
import merchantRoutes from './routes/merchant';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/v1/user',userRoutes)
app.use('/api/v1/merchant',merchantRoutes)  

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});