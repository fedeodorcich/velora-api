import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { env } from '../../core/config/env.js';
import { User } from '../users/entities/user.entity.js';
@Injectable()
export class AdvertisingService {
 constructor(@InjectRepository(User) private readonly users:Repository<User>){}
 async status(userId:string){
 const user=await this.users.findOne({where:{id:userId},select:{id:true,adFreeSince:true}});
 if(!user)throw new NotFoundException('La cuenta no existe.');
 const adFree=Boolean(user.adFreeSince);
 const c=env.advertising;
 return {adFree,adFreeSince:user.adFreeSince?.toISOString()??null,adsense:!adFree&&c.enabled&&c.provider==='adsense'&&env.adsense.client&&env.adsense.slot?{client:env.adsense.client,slot:env.adsense.slot}:null,sponsor:!adFree&&c.enabled&&c.provider!=='adsense'&&c.name&&c.url?{name:c.name,description:c.description,url:c.url}:null};
 }
 // Exclusivo de la herramienta operativa: nunca se expone como endpoint público.
 async grant(userId:string,paymentRef:string):Promise<void>{
 if(!/^[0-9a-f-]{36}$/i.test(userId)||!/^mp:[0-9]{1,32}$/.test(paymentRef))throw new ConflictException('Usá UUID de cuenta y referencia mp:ID del pago verificado.');
 const user=await this.users.findOne({where:{id:userId},select:{id:true,adFreeSince:true,adFreePaymentRef:true}});
 if(!user)throw new NotFoundException('La cuenta no existe.');
 if(user.adFreeSince)return;
 try { const result=await this.users.update({id:userId,adFreeSince:IsNull()},{adFreeSince:new Date(),adFreePaymentRef:paymentRef});
 if(!result.affected)throw new ConflictException('La cuenta cambió. Consultá su estado.');
 }catch(error){if(error&&typeof error==='object'&&'code' in error&&error.code==='23505')throw new ConflictException('Ese pago ya está asociado a otra cuenta.');throw error;}
 }
}
