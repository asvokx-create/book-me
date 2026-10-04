import assert from "node:assert/strict";
import test from "node:test";

import { calculateCommerceSelection, nextOccurrence, type CouponRule, type ServiceAddOn, type ServicePackage } from "../lib/service-commerce.ts";

const packageOption:ServicePackage={id:"package-1",name:"Premium",description:"",priceCents:12_000,durationMinutes:120,deliveryDays:null,revisionCount:null,features:[]};
const addOn:ServiceAddOn={id:"addon-1",name:"Extra room",description:"",priceCents:1_500,additionalMinutes:30,allowsQuantity:true,maxQuantity:3};
const coupon:CouponRule={id:"coupon-1",code:"SAVE20",discountType:"percentage",discountValue:20,minimumSubtotalCents:5_000,firstBookingOnly:false,repeatCustomerOnly:false,expiresAt:null,usageLimit:null,redemptionCount:0};

test("package, add-on quantity, and provider-funded coupon produce an auditable subtotal",()=>{
  const result=calculateCommerceSelection({servicePriceCents:10_000,selectedPackage:packageOption,addOns:[{addOn,quantity:2}],coupon});
  assert.deepEqual({base:result.basePriceCents,addons:result.addOnTotalCents,original:result.originalSubtotalCents,discount:result.discountCents,total:result.serviceSubtotalCents},{base:12_000,addons:3_000,original:15_000,discount:3_000,total:12_000});
});

test("non-quantity add-ons cannot be multiplied by a tampered request",()=>{
  const single={...addOn,allowsQuantity:false};
  const result=calculateCommerceSelection({servicePriceCents:10_000,addOns:[{addOn:single,quantity:99}]});
  assert.equal(result.addOnTotalCents,1_500);
  assert.equal(result.selectedAddOns[0].quantity,1);
});

test("quantity add-ons reject values beyond the provider maximum",()=>{
  assert.throws(()=>calculateCommerceSelection({servicePriceCents:10_000,addOns:[{addOn,quantity:4}]}),/valid quantity/);
});

test("fixed coupons never reduce the service subtotal below zero",()=>{
  const fixed={...coupon,discountType:"fixed" as const,discountValue:99_999,minimumSubtotalCents:0};
  const result=calculateCommerceSelection({servicePriceCents:2_000,addOns:[],coupon:fixed});
  assert.equal(result.discountCents,2_000);
  assert.equal(result.serviceSubtotalCents,0);
});

test("percentage coupons round once at the cent boundary",()=>{
  const result=calculateCommerceSelection({servicePriceCents:999,addOns:[],coupon:{...coupon,discountValue:33,minimumSubtotalCents:0}});
  assert.equal(result.discountCents,330);
  assert.equal(result.serviceSubtotalCents,669);
});

test("a coupon discounts the package and add-ons together without changing their audit lines",()=>{
  const result=calculateCommerceSelection({servicePriceCents:10_000,selectedPackage:packageOption,addOns:[{addOn,quantity:3}],coupon:{...coupon,discountType:"fixed",discountValue:2_500,minimumSubtotalCents:0}});
  assert.equal(result.basePriceCents,12_000);
  assert.equal(result.addOnTotalCents,4_500);
  assert.equal(result.originalSubtotalCents,16_500);
  assert.equal(result.discountCents,2_500);
  assert.equal(result.serviceSubtotalCents,14_000);
});

test("100 percent discounts remain mathematically bounded for the booking layer to enforce its minimum",()=>{
  const result=calculateCommerceSelection({servicePriceCents:10_000,addOns:[],coupon:{...coupon,discountValue:100,minimumSubtotalCents:0}});
  assert.equal(result.discountCents,10_000);
  assert.equal(result.serviceSubtotalCents,0);
});

test("coupon expiration, minimum, and usage limit are enforced",()=>{
  assert.throws(()=>calculateCommerceSelection({servicePriceCents:4_000,addOns:[],coupon}),/minimum/);
  assert.throws(()=>calculateCommerceSelection({servicePriceCents:10_000,addOns:[],coupon:{...coupon,expiresAt:new Date("2020-01-01")}}),/expired/);
  assert.throws(()=>calculateCommerceSelection({servicePriceCents:10_000,addOns:[],coupon:{...coupon,usageLimit:2,redemptionCount:2}}),/usage limit/);
});

test("monthly recurrence clamps safely at the end of shorter months",()=>{
  assert.equal(nextOccurrence(new Date("2028-01-31T18:00:00.000Z"),"monthly").toISOString(),"2028-02-29T18:00:00.000Z");
  assert.equal(nextOccurrence(new Date("2027-01-31T18:00:00.000Z"),"monthly").toISOString(),"2027-02-28T18:00:00.000Z");
});

test("weekly and biweekly recurrence preserve UTC time",()=>{
  const start=new Date("2026-10-03T17:45:00.000Z");
  assert.equal(nextOccurrence(start,"weekly").toISOString(),"2026-10-10T17:45:00.000Z");
  assert.equal(nextOccurrence(start,"biweekly").toISOString(),"2026-10-17T17:45:00.000Z");
});
