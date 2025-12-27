//global::filename SortDoubleLinkList
//global::import * from BlockDataIO

const SortDoubleLinkList = class{
  #pos1
  #pos2
  #root
  #insert
  #deleteData
  #randomPos
  #allDataForEach
  #getData
  #editPromise
  constructor(pos1,pos2,root){
    this.#pos1 = pos1
    this.#pos2 = pos2
    this.#root = root

    function* insert(num,data,self){
      let firstData = yield BlockDataIO.read(self.#root)
      if(!firstData){
        yield BlockDataIO.write(self.#root,{key:num,data,back:null,next:null})
        return
        }
      if(firstData.key > num){
        // shift data
        const newPos = yield self.#randomPos(self.#pos1,self.#pos2)
        firstData.back = self.#root
        yield BlockDataIO.write(newPos,firstData)
        yield BlockDataIO.write(self.#root,{key:num,data,back:null,next:newPos})
        return;
        }
      if(firstData.key < num){
        let nowData = firstData
        let nowDataPos = self.#root
        // search data
        while(true){
          if(!nowData.next)break;
          if(nowData.key >= num)break;
          nowDataPos = nowData.next
          nowData = yield BlockDataIO.read(nowData.next)
          }
        if(nowData.key === num){
          yield BlockDataIO.write(nowDataPos,{key:num,data,back:nowData.back,next:nowData.next})
          return;
          }
        const newPos = yield self.#randomPos(self.#pos1,self.#pos2)
        // push data
        if(!nowData.next){
          yield BlockDataIO.write(newPos,{key:num,data,back:nowDataPos,next:null})
          nowData.next = newPos
          yield BlockDataIO.write(nowDataPos,nowData)
          return;
          }
        // splice data (oldData <-> newData <-> nowData)
        yield BlockDataIO.write(newPos,{key:num,data,back:nowData.back,next:nowDataPos})
        let backData = yield BlockDataIO.read(nowData.back)
        backData.next = newPos
        yield BlockDataIO.write(nowData.back,backData)
        nowData.back = newPos
        yield BlockDataIO.write(nowDataPos,nowData)
        }
      }
    this.#insert = asyncFunction(insert)


    function* randomPos(pos1,pos2){
      const [ax,ay,a_x] = pos1
      const [bx,by,bz] = pos2
      const minMaxIntRandom = (min,max) => Math.floor(Math.random() * (max-min+1))+min
      const randomPosArray = () => [minMaxIntRandom(ax,bx),minMaxIntRandom(ay,by),minMaxIntRandom(a_x,bz)]
      while(true){
        const testPos = randomPosArray()
        const data = yield BlockDataIO.read(testPos)
        if(!data)return testPos
        }
      }

    this.#randomPos = asyncFunction(randomPos)

    function* deleteData(num,self){
      let nowData = yield BlockDataIO.read(self.#root)
      let nowDataPos = self.#root
        while(true){
          if(!nowData.next)break;
          if(nowData.key === num)break;
          nowDataPos = nowData.next
          nowData = yield BlockDataIO.read(nowData.next)
          }     
      if(nowData.key !== num)return -1
      const nextPos = nowData.next
      const backPos = nowData.back
      if(backPos){
        let backData = yield BlockDataIO.read(backPos)
        backData.next = nextPos
        yield BlockDataIO.write(backPos,backData)
        }
      // if root node,move nextData & change nextData.back
      if(!backPos && nextPos){
        let nextData = yield BlockDataIO.read(nextPos)
        nextData.back = null
        yield BlockDataIO.write(self.#root,nextData)
        const nextNextPos = nextData.next
        if(nextNextPos){
          let nextNextData = yield BlockDataIO.read(nextNextPos)
          nextNextData.back = self.#root
          yield BlockDataIO.write(nextNextPos,nextNextData)
          }
        }
      if(backPos && nextPos){
        let nextData = yield BlockDataIO.read(nextPos)
        nextData.back = backPos
        yield BlockDataIO.write(nextPos,nextData)
        }
      yield BlockDataIO.write(nowDataPos,undefined)
      })

    this.#deleteData = asyncFunction(deleteData)
    
    this.#getData = asyncFunction(function* (num,self){
      let nowData = yield BlockDataIO.read(self.#root)
      let nowDataPos = self.#root
      while(true){
        if(!nowData.next)break;
        if(nowData.key === num)break;
        nowDataPos = nowData.next
        nowData = yield BlockDataIO.read(nowData.next)
        }   
      if(nowData.key !== num)return -1
      return nowData.data       
      })

    this.#allDataForEach = asyncFunction(function* (callback,self){
      let nowData = yield BlockDataIO.read(self.#root)
      let nowDataPos = self.#root
      while(true){
        const copy = JSON.parse(JSON.stringify(nowData))
        try{
          callback(copy.data,copy.key)
          }
        catch(e){
          Logger.error({e,data:nowData},"SortDoubleLinkList allDataForEach error")
          break;
          }
        if(!nowData.next)break;
        nowDataPos = nowData.next
        nowData = yield BlockDataIO.read(nowData.next)
        }
      })
    this.#editPromise = Promise.resolve("");
    }

insert(num,data){
  let resolve,reject
  const promise = new Promise((a,b) => {
    resolve=a
    reject=b
    })
  this.#editPromise = this.#editPromise.then(() => this.#insert(num,data,this))
    .then(() => {resolve()})
    .catch(e => {
      Logger.error({e,num,data},"insert error SortDoubleLinkList")
      reject(e)
    })
  return promise
  }

deleteData(num){
  let resolve,reject
  const promise = new Promise((a,b) => {
    resolve=a
    reject=b
    })
  this.#editPromise = this.#editPromise.then(() => this.#deleteData(num,this))
    .then(() => {resolve()})
    .catch(e => {
      Logger.error({e,num},"deleteData error SortDoubleLinkList")
      reject(e)
    })
  return promise
  }

  allDataForEach(callback){
    return this.#allDataForEach(callback,this)
    }

  getData(num){
    return this.#getData(num,this)
    }

  }

exportData("SortDoubleLinkList",SortDoubleLinkList)
