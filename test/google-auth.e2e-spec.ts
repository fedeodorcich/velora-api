import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
import { API,createE2eApp,registerUser,resetDatabase } from './support/e2e-app.js';
import { User } from '../src/modules/users/entities/user.entity.js';
const nonce='123456789012345678901234567890123456';
const identity=vi.hoisted(()=>({sub:'google-e2e',email:'google-e2e@gmail.com',name:'Google E2E',email_verified:true,nonce:'123456789012345678901234567890123456'}));
vi.mock('google-auth-library',()=>({OAuth2Client:class{async verifyIdToken(){return {getPayload:()=>identity};}}}));
vi.mock('../src/core/config/env.js',async original=>{const actual=await original<typeof import('../src/core/config/env.js')>();return {env:{...actual.env,googleClientId:'e2e.apps.googleusercontent.com'}};});
describe('Google auth con PostgreSQL',()=>{
 let app:INestApplication;
 beforeAll(async()=>{app=await createE2eApp();await resetDatabase(app);});
 afterAll(async()=>{await app?.close();});
 it('crea cuenta y emite sesión válida sin exponer credenciales internas',async()=>{
 const result=await request(app.getHttpServer()).post(API+'/auth/google').send({credential:'google-test-credential',nonce}).expect(200);
 expect(result.body.user.email).toBe(identity.email);expect(result.body.user).not.toHaveProperty('passwordHash');expect(result.body.user).not.toHaveProperty('googleSub');
 await request(app.getHttpServer()).get(API+'/auth/profile').set('Authorization','Bearer '+result.body.accessToken).expect(200);
 const repeat=await request(app.getHttpServer()).post(API+'/auth/google').send({credential:'google-test-credential',nonce}).expect(200);
 expect(repeat.body.user.id).toBe(result.body.user.id);
 expect(await app.get(DataSource).getRepository(User).count({where:{email:identity.email}})).toBe(1);
 });
 it('asocia cuenta Gmail conservando id y acceso por contraseña',async()=>{
 const existing=await registerUser(app,{email:'existing-google@gmail.com'});identity.sub='existing-google';identity.email=existing.email;
 const result=await request(app.getHttpServer()).post(API+'/auth/google').send({credential:'google-test-credential',nonce}).expect(200);
 expect(result.body.user.id).toBe(existing.user.id);
 await request(app.getHttpServer()).post(API+'/auth/login').send({email:existing.email,password:existing.password}).expect(200);
 });
 it('rechaza nonce incorrecto y DTO inválido sin registrar usuarios',async()=>{
 await request(app.getHttpServer()).post(API+'/auth/google').send({credential:'google-test-credential',nonce:'wrong-nonce-12345678901234567890123456'}).expect(401);
 await request(app.getHttpServer()).post(API+'/auth/google').send({credential:'tiny',nonce}).expect(400);
 });
});
