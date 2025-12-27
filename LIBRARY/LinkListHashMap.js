
//global::filename LinkListHashMap
//global::import * from BlockDataIO
const LinkListHashMap = class{
#addData
#deleteData
#allDataForEach
#editPromise
constructor(pos1,pos2){
  this.startKey = "[[aaaaaaaaaaaaaaaaaaaa]]"
  this.pos1 = pos1
  this.pos2 = pos2
  this.#editPromise = Promise.resolve("");
  this.#addData = asyncFunction(function* (key,value,self){
    const keyPos = self.#keyToPos(key)
    let data = yield BlockDataIO.read(keyPos)
    if(data?.[key] && !data?.[key]?.isDelete){
      data[key].data = value
      yield BlockDataIO.write(keyPos,data)
      return;
      }
    if(key === self.startKey){
      data ??= {}
      data[key] =  {next:null,data:value,isDelete:false}
      yield BlockDataIO.write(keyPos,data)
      return;
      }
    if(data?.[key]?.isDelete){
      data[key].isDelete = false
      data[key].data = value
      yield BlockDataIO.write(keyPos,data)
      return;
      }
    let startData = yield BlockDataIO.read(self.#keyToPos(self.startKey))     
    data ??= {}
    data[key] ??= {}
    data[key] = {next:startData[self.startKey].next,data:value,isDelete:false}
    yield BlockDataIO.write(keyPos,data)
    startData[self.startKey].next = {[key]:self.#keyToPos(key)}
    yield BlockDataIO.write(self.#keyToPos(self.startKey),startData)
    })
  this.#deleteData = asyncFunction(function* (key,self){
    let data = yield BlockDataIO.read(self.#keyToPos(key))
    if(!data?.[key])return;
    if(data[key]?.isDelete)return;
    data[key].isDelete = true
    yield BlockDataIO.write(self.#keyToPos(key),data)
    })
  this.#allDataForEach = asyncFunction(function* (callback,startKey,getPos){
    const firstData = yield BlockDataIO.read(getPos(startKey))
    let nowData = firstData?.[startKey]
    while(nowData && nowData.next){
      const [nextKey,nextPos] = Object.entries(nowData.next)[0]
      const rawData = yield BlockDataIO.read(nextPos)
      const data = rawData?.[nextKey]
      nowData = data
      if(!data)break;
      if(data.isDelete)continue;
      try{yield callback(data.data,nextKey);}catch(e){
        Logger.error({e,data,nextKey},"allDataForEach")
        break;
        }
      }
    })
  this.addData(this.startKey,"start data")
  }

addData(key,value){
  let resolve,reject
  const promise = new Promise((a,b) => {
    resolve=a
    reject=b
    })
  this.#editPromise = this.#editPromise.then(() => this.#addData(key,value,this))
    .then(() => {resolve()})
    .catch(e => {
      Logger.error({e,key,value},"add data error in listlisthashmap")
      reject(e)
    })
  return promise
  }
deleteData(key){
  let resolve,reject
  const promise = new Promise((a,b) => {
    resolve=a
    reject=b
    })
  this.#editPromise = this.#editPromise.then(() => this.#deleteData(key,this))
    .then(() => {resolve()})
    .catch(e => {
      Logger.error({e,key},"delete data error in listlisthashmap")
      reject(e)
    })
  return promise
  }
allDataForEach(callback){
  return this.#allDataForEach(callback,this.startKey,(key) => this.#keyToPos(key))
  }

getData(key){
  return BlockDataIO.read(this.#keyToPos(key)).then(value => value?.[key]?.data)
  }



#getHash(str){
  let h = 2166136261 >>> 0
  for(let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 16777619)
    }
  return (h >>> 0)
  }

#getPos(num){
  const {pos1,pos2} = this
  return [
    (num % (pos2[0]-pos1[0]))+pos1[0],
    (Math.floor(num / (pos2[0] - pos1[0]))%(pos2[1] - pos1[1]))+pos1[1],
    (Math.floor(num / ((pos2[0] - pos1[0]) * (pos2[1] - pos1[1])))%(pos2[2] - pos1[2]))+pos1[2]
     ]
  }

#keyToPos(key){
  return this.#getPos(this.#getHash(key))
  }

}
exportData("LinkListHashMap",LinkListHashMap)

