const express = require('express');
const cors = require('cors');
const identifyRoutes = require('./routes/identify');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/identify', identifyRoutes);

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`Server has started on port: ${PORT}`);
});