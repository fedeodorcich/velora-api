import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {DataSource} from 'typeorm';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {API,createE2eApp,registerUser,resetDatabase} from './support/e2e-app.js';
import {User} from '../src/modules/users/entities/user.entity.js';
import {AdvertisingService} from '../src/modules/community/advertising.service.js';
vi.mock('../src/core/config/env.js',async original=>{const actual=await original<typeof import('../src/core/config/env.js')>();return {env:{...actual.env,advertising:{enabled:true,name:'Anunciante de prueba',description:'Patrocinio de prueba',url:'https://example.com'}}};});
describe('Anuncios por cuenta',()=>{
 let app:INestApplication;
 beforeAll(async()=>{app=await createE2eApp();await resetDatabase(app);});
 afterAll(async()=>{await app?.close();});
 it('requiere JWT y conserva beneficio permanente solo para el titular',async()=>{
 await request(app.getHttpServer()).get(API+'/community/advertising').expect(401);
 const donor=await registerUser(app);const other=await registerUser(app);
 await app.get(AdvertisingService).grant(donor.user.id,'mp:987654321');
 const paid=await request(app.getHttpServer()).get(API+'/community/advertising').set(donor.auth).expect(200);
 expect(paid.body).toMatchObject({adFree:true,sponsor:null});expect(paid.body).not.toHaveProperty('adFreePaymentRef');
 const free=await request(app.getHttpServer()).get(API+'/community/advertising').set(other.auth).expect(200);
 expect(free.body).toMatchObject({adFree:false,sponsor:{name:'Anunciante de prueba'}});
 await expect(app.get(AdvertisingService).grant(other.user.id,'mp:987654321')).rejects.toMatchObject({status:409});
 const users=app.get(DataSource).getRepository(User);
 expect(await users.count()).toBe(2);
 });
 it('no expone un endpoint para que el usuario se conceda el beneficio',async()=>{
 const session=await registerUser(app);
 await request(app.getHttpServer()).post(API+'/community/advertising').set(session.auth).send({adFree:true}).expect(404);
 expect((await request(app.getHttpServer()).get(API+'/community/advertising').set(session.auth)).body.adFree).toBe(false);
 });
});
