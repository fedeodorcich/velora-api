import { beforeEach,describe,it,expect,vi } from 'vitest';
import type { Repository } from 'typeorm';
import type { User } from '../users/entities/user.entity.js';
import { AdvertisingService } from './advertising.service.js';
const config=vi.hoisted(()=>({provider:'sponsor',enabled:true,name:'Patrocinador',description:'Servicio útil',url:'https://example.com'}));
vi.mock('../../core/config/env.js',()=>({env:{advertising:config,adsense:{client:'ca-pub-1234567890123456',slot:'1234567890'}}}));
const users={findOne:vi.fn(),update:vi.fn()};
const id='12345678-1234-1234-1234-123456789012';
let service:AdvertisingService;
beforeEach(()=>{vi.resetAllMocks();config.enabled=true;config.provider='sponsor';users.update.mockResolvedValue({affected:1});service=new AdvertisingService(users as unknown as Repository<User>);});
describe('Anuncios y beneficio permanente',()=>{
 it('elige AdSense sin mezclar patrocinadores',async()=>{config.provider='adsense';users.findOne.mockResolvedValue({id});expect(await service.status(id)).toMatchObject({adFree:false,sponsor:null,adsense:{client:'ca-pub-1234567890123456',slot:'1234567890'}});});
 it('no devuelve configuración AdSense a aportantes',async()=>{config.provider='adsense';users.findOne.mockResolvedValue({id,adFreeSince:new Date()});expect(await service.status(id)).toMatchObject({adFree:true,sponsor:null,adsense:null});});
 it('deshabilita AdSense si está apagada la publicidad',async()=>{config.provider='adsense';config.enabled=false;users.findOne.mockResolvedValue({id});expect(await service.status(id)).toMatchObject({adsense:null,sponsor:null});});

 it('solo devuelve anuncios a una cuenta sin beneficio y filtra por su id',async()=>{users.findOne.mockResolvedValue({id,adFreeSince:null});expect(await service.status(id)).toMatchObject({adFree:false,sponsor:{name:'Patrocinador'}});expect(users.findOne).toHaveBeenCalledWith({where:{id},select:{id:true,adFreeSince:true}});});
 it('no devuelve anuncios a un aportante aunque hayan pasado años',async()=>{users.findOne.mockResolvedValue({id,adFreeSince:new Date('2020-01-01')});expect(await service.status(id)).toMatchObject({adFree:true,sponsor:null});});
 it('no publica patrocinadores cuando se deshabilita la publicidad',async()=>{config.enabled=false;users.findOne.mockResolvedValue({id});expect(await service.status(id)).toMatchObject({sponsor:null});});
 it('otorga beneficio sin fecha de vencimiento después de verificación operativa',async()=>{users.findOne.mockResolvedValue({id});await service.grant(id,'mp:12345');expect(users.update).toHaveBeenCalledWith(expect.objectContaining({id}),{adFreeSince:expect.any(Date),adFreePaymentRef:'mp:12345'});});
 it('es idempotente para una cuenta que ya aportó',async()=>{users.findOne.mockResolvedValue({id,adFreeSince:new Date()});await service.grant(id,'mp:12345');expect(users.update).not.toHaveBeenCalled();});
 it('no permite acreditar el mismo pago a otra cuenta',async()=>{users.findOne.mockResolvedValue({id});users.update.mockRejectedValue({code:'23505'});await expect(service.grant(id,'mp:12345')).rejects.toMatchObject({status:409});});
 it('rechaza referencias libres o cuentas inexistentes',async()=>{await expect(service.grant(id,'me-donaron')).rejects.toMatchObject({status:409});users.findOne.mockResolvedValue(null);await expect(service.grant(id,'mp:12345')).rejects.toMatchObject({status:404});});
});
