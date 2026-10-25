import { describe,it,expect,vi } from 'vitest';
import { recordProviderEvidence } from './purchase-evidence.server';
function database() {
  const upsert=vi.fn().mockResolvedValue({error:null});
  const db={from:vi.fn((table:string) => table==='orders' ? {select:() => ({eq:() => ({maybeSingle:async () => ({data:{id:'order',user_id:'buyer',mp_payment_id:'123',amount:100},error:null})})})} : {upsert})};
  return {db,upsert};
}
describe('provider evidence',() => {
  it('rejects a payment from another order',async () => {
    const {db,upsert}=database();
    await recordProviderEvidence(db,'order',{id:123,status:'approved',external_reference:'other',transaction_amount:100});
    expect(upsert).not.toHaveBeenCalled();
  });
  it('records only available provider fields, not a bank document or full payload',async () => {
    const {db,upsert}=database();
    await recordProviderEvidence(db,'order',{id:123,status:'approved',external_reference:'order',transaction_amount:100,payer:{first_name:'Eliane',last_name:'da Silva'},metadata:{private:'not stored'}});
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({payer_name:'Eliane da Silva',source:'mercadopago',provider_payment_id:'123'}),{onConflict:'provider_payment_id'});
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('metadata');
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('storage_path');
  });
  it('rejects an underpaid payment',async () => {
    const {db,upsert}=database();
    await recordProviderEvidence(db,'order',{id:123,status:'approved',external_reference:'order',transaction_amount:1});
    expect(upsert).not.toHaveBeenCalled();
  });
});