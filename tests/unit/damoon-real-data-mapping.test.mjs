import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcile } from "../../scripts/hotel/damoon-real-data-import.mjs";
const units = Array.from({length:31},(_,i)=>({unit_code:String(i+100),category:"double",floor:null}));
const source={units:{units}};
const room={id:"room-a",code:"100",deletedAt:null,updatedAt:new Date("2026-01-01"),reservationCount:0,maintenanceCount:0,mediaCount:0};
const verification={sourceCode:"100",roomId:"room-a",updatedAt:room.updatedAt.toISOString(),externalDependenciesAbsent:true};
test("physical identity needs explicit verification and never derives from hypothetical draft IDs",()=>{
 const drafts=[{id:"draft",temporaryCode:"DRAFT-ROOM-SINGLE-01",promotedRoomId:null}];
 const report=reconcile(source,drafts,[room]);
 assert.equal(report.rows[0].action,"PRESERVE_REVIEW"); assert.equal(report.rows[1].action,"PROPOSE_CREATE");
 assert.equal(report.draftProposals[0].action,"PROPOSE_SUPERSEDE_REVIEW");
 assert.equal(reconcile(source,drafts,[room],[verification]).rows[0].action,"RECONCILE_EXISTING");
 assert.equal(reconcile(source,drafts,[{...room,reservationCount:1}],[verification]).rows[0].action,"PRESERVE_REVIEW");
 assert.equal(reconcile(source,drafts,[{...room,mediaCount:1}],[verification]).rows[0].action,"PRESERVE_REVIEW");
});
test("ambiguous, duplicate and cross-property attestations fail closed",()=>{
 for(const entries of [[{...verification,roomId:"foreign"}],[verification,verification],[{...verification,externalDependenciesAbsent:false}],[{...verification,sourceCode:"999"}]]) assert.throws(()=>reconcile(source,[],[room],entries));
});
