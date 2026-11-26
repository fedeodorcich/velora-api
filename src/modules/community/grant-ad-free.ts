import dataSource from '../../core/database/data-source.js';
import { AdvertisingService } from './advertising.service.js';
import { User } from '../users/entities/user.entity.js';
const [userId,paymentRef,confirmation,...extra]=process.argv.slice(2);
if(!userId||!paymentRef||confirmation!=='--verified'||extra.length)throw new Error('Uso: npm run community:grant-ad-free -- UUID mp:ID --verified. Verificá primero importe positivo, estado aprobado, cuenta receptora real y titularidad del aporte.');
await dataSource.initialize();
try{await new AdvertisingService(dataSource.getRepository(User)).grant(userId,paymentRef);console.log('Cuenta habilitada sin anuncios para siempre.');}finally{await dataSource.destroy();}
