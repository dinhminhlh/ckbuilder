// Week 07 observations added around the pinned official Perun example.
// Original example: Apache-2.0, PolyCrypt GmbH and contributors.
package main

import (
    "encoding/json"
    "fmt"
    "math/big"
    "os"
    "path/filepath"
    "time"
    "perun.network/perun-examples/payment-channel-ckb/client"
)
type observedState struct {
    ChannelID string `json:"channelId"`
    Version uint64 `json:"version"`
    Final bool `json:"isFinal"`
    Alice string `json:"aliceShannons"`
    Bob string `json:"bobShannons"`
}
func observeState(ch *client.PaymentChannel) observedState {
    s:=ch.State()
    if len(s.Balances)!=1 || len(s.Balances[0])!=2 { panic("expected one-asset two-party channel") }
    return observedState{fmt.Sprintf("0x%x",s.ID),s.Version,s.IsFinal,s.Balances[0][0].String(),s.Balances[0][1].String()}
}
func recordPair(stage string,a,b *client.PaymentChannel,expectedA,expectedB int64) {
    var left,right observedState
    for attempt:=0; attempt<50; attempt++ {
        left,right=observeState(a),observeState(b)
        if left==right { break }
        time.Sleep(100*time.Millisecond)
    }
    if left!=right { panic("channel views differ") }
    if left.Alice!=fmt.Sprint(expectedA*100000000) || left.Bob!=fmt.Sprint(expectedB*100000000) { panic("allocation differs from expected payment") }
    total:=new(big.Int)
    aa,_:=new(big.Int).SetString(left.Alice,10)
    bb,_:=new(big.Int).SetString(left.Bob,10)
    total.Add(aa,bb)
    if total.String()!="20000000000" { panic("channel allocation not conserved") }
    result:=map[string]interface{}{"capturedAt":time.Now().UTC().Format(time.RFC3339Nano),"stage":stage,"source":"live go-perun channel state after protocol operation","aliceView":left,"bobView":right,"viewsMatch":true,"totalShannons":total.String()}
    dir:=os.Getenv("WEEK07_EVIDENCE")
    if dir=="" { panic("WEEK07_EVIDENCE must be configured") }
    encoded,err:=json.MarshalIndent(result,"","  "); if err!=nil {panic(err)}
    if err=os.WriteFile(filepath.Join(dir,stage+".json"),append(encoded,'\n'),0600);err!=nil {panic(err)}
    fmt.Printf("WEEK07 %s: version=%d allocation=%s/%s final=%t\n",stage,left.Version,left.Alice,left.Bob,left.Final)
}

