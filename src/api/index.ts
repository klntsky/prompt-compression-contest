import 'reflect-metadata';
import AppDataSource from './data-source';

AppDataSource.initialize()
  .then(async () => {
    // here you can start to work with your database
  })
  .catch(error => console.log(error));
