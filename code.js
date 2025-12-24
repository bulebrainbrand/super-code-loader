

const showLog = {
  error:true,
  warn:true,
  info:true,
  debug:true,
  assert:true
}

const logJsonIndent = 0

const codeBlockListPos = [10000,-150,10000]

const useCallback = [
"playerCommand",
"onload",
]

const systemCallback = [
"tick",
]

let callbackFuncData = {}
for(const name of useCallback){
callbackFuncData[name] = []
globalThis[name] = (...arg) => {
  let willReturn = undefined
  for(const {pos,fileName,func} of callbackFuncData[name]){
    try{
      const value = func(...arg)
      if(value != null){
        if(willReturn != null && value != willReturn){
          Logger.debug({firstValue:willReturn,secondValue:value,callback:name},`two return value.willReturn ${willReturn}`)
          }
        willReturn = value
        }
      }
    catch(e){
      Logger.error({e,pos,fileName,func,callbackName:name},"in callback")
      }
    }
  return willReturn
  }
}

for(const name of systemCallback){
  callbackFuncData[name] = []
  }

var Logger = {
  error(obj,text){
    if(!showLog.error)return;
    const errorObj = Object.values(obj).find(data => data instanceof Error)
    console.log(`❌️[error] ${text} \n${errorObj?.toString()??"not found error object"} \nstack:\n${errorObj?.stack??"stack not found"} \ndata:\n${JSON.stringify(obj,null,logJsonIndent)}`)
  },
  warn(obj,text){
    if(!showLog.warn)return;
    console.log(`🟧[warning] ${text} \ndata:\n${JSON.stringify(obj,null,logJsonIndent)}`)
  },
  info(obj,text){
    if(!showLog.info)return;
    console.log(`🟦[info] ${text} \ndata:\n${JSON.stringify(obj,null,logJsonIndent)}`)
  },
  debug(obj,text){
    if(!showLog.debug)return;
    console.log(`⬜️[debug] ${text} \ndata:\n${JSON.stringify(obj,null,logJsonIndent)}`)
  },
  assert(bool,text,obj){
    if(!showLog.assert)return;
    if(bool === false){ 
      console.log(`🫖[assert] ${text} \ndata:\n${obj?JSON.stringify(obj,null,logJsonIndent):"data not found"}`)
    }
  }
}

var BlockDataIO = class{
  static write(pos,data){
    return new Promise((resolve,reject) => {
      waitLoadBlock(pos,resolve)
    })
    .then(() => api.setBlockData(...pos,{persisted:{shared:{data}}}))
  }
  static read(pos){
    return new Promise((resolve,reject) => {
      waitLoadBlock(pos,resolve)
    })
    .then(() => api.getBlockData(...pos)?.persisted?.shared?.data)
  }
}

const readCodeBlock = (pos) => {
  return new Promise((resolve,reject) => {
    waitLoadBlock(pos,resolve)
  })
  .then(() => api.getBlockData(...pos)?.persisted?.shared?.text)
}

const waitLoadBlockGene = function* (pos,resolve){
  if(!resolve)throw new TypeError("waitLoadBlockGene need resolve")
  while(!api.isBlockInLoadedChunk(...pos)){
    api.getBlock(pos)
    yield;
  }
  resolve()
}

const waitLoadBlock = (pos,resolve) => {
  runningGenes.push(waitLoadBlockGene(pos,resolve))
}

var Promise = class{
  constructor(callback){
    this.state = "pending"
    this.value = undefined
    this.reason = undefined
    this.handlers = []
    const resolve = (value) => {
      if(value instanceof Promise){
        value.then(resolve,reject)
        return
      }
      this.value = value
      this.state = "fulfilled"
      this._runHandlers()
    }
    const reject = (reason) => {
      this.reason = reason
      this.state = "rejected"
      this._runHandlers()
    }
    try{
      callback(resolve,reject)
    }catch(e){
      reject(e)
    }
  }
  _runHandlers(){
    if(this.state === "pending")return;
    queueMicrotask(() => {
      const oldHandlers = this.handlers
      this.handlers = []
      for(const {onFulfilled,onRejected} of oldHandlers){
        if(this.state === "fulfilled" && onFulfilled){
          onFulfilled(this.value)
          continue;
        }
        if(this.state === "rejected" && onRejected){
          onRejected(this.reason)
          continue;
        }
      }     
    })
  }
  then(onFulfilled,onRejected){
    return new Promise((resolve,reject) => {
      const handler = {
        onFulfilled:onFulfilled ? (value) => {
          try{
            const result = onFulfilled(value)
            this._handleResolution(result,resolve,reject)
          }catch(error){
            reject(error)
          }}:resolve,
        onRejected:onRejected ? (reason) => {
          try{
            const result = onRejected(reason)
            this._handleResolution(result,resolve,reject)
          }catch(error){
            reject(error)
          }}:reject
      }
      this.handlers.push(handler)
      if(this.state !== 'pending')this._runHandlers();
    })
  }
  catch(onRejected){
    return this.then(null,onRejected)
  }
  _handleResolution(result,resolve,reject){
    if(this === result)throw new TypeError("do not return this in then/catch")
    if(result instanceof Promise){
      result.then(resolve,reject)
    }else{
      resolve(result)
    }
  }
  static resolve(value){
    return value instanceof Promise?value:new Promise((resolve) => resolve(value))
  }
  static all(promises = []){
    const arrayPromise = [...promises]
    if(arrayPromise.length === 0)return Promise.resolve([]);
    return new Promise((resolve,reject) => {
      let data = []
      const amount = arrayPromise.length
      let resolveAmount = 0
      let rejected = false
      for(const [i,promise] of arrayPromise.map(Promise.resolve).entries()){
        promise.then(value => {
          if(rejected)return;
          resolveAmount++
          data[i] = value
          if(amount === resolveAmount)resolve(data);
        },
        e => {
          if(rejected)return;
          rejected = true
          reject(e)
        })
      }
    })
  }
}

var asyncFunction = (geneFunction) => {
return (...arg) => {
  let resolve,reject
  const promise = new Promise((a,b) => {
    resolve=a
    reject=b
    })
  const func = geneFunction(...arg)
  const awaitFunc = ({value,done}) => {
    if(done){
      resolve(value)
      return;
      };
    Promise.resolve(value)
    .then(value => 
      macrotaskQueue.push(
        () => {
          try{
            awaitFunc(func.next(value))
            }
          catch(e){awaitFunc(func.throw(e))}
          }
        )
      )
    }
  awaitFunc(func.next())
  return promise
  }
}

let microtaskQueue = []
let macrotaskQueue = []
let timeoutQueue = []
let runningGenes = []
let callStack = []

var queueMicrotask = (callback) => {
  if(typeof callback !== "function"){
    Logger.error({value:callback},"[queueMicrotask] do not add not function value")
    throw new TypeError("[queueMicrotask] do not add not function value")
  }
  microtaskQueue.push(callback)
};

var setTimeout = (func,time,...args) => {
  const funcRunTime = api.now() + time
  add: {
    for(let i = 0;i<timeoutQueue.length;i++){
      const {runTime} = timeoutQueue[i]
      if(funcRunTime <= runTime){
        timeoutQueue.splice(i,0,{runTime:funcRunTime,func,interval:null,args})
        break add;
      }
    }
    timeoutQueue.push({runTime:funcRunTime,func,interval:null,args})
  }
}

var setInterval = (func,interval,...args) => {
  const funcRunTime = api.now() + interval
  add: {
    for(let i = 0;i<timeoutQueue.length;i++){
      const {runTime} = timeoutQueue[i]
      if(funcRunTime < runTime){
        timeoutQueue.splice(i,0,{runTime:funcRunTime,func,interval,args})
        break add;
      }
    }
    timeoutQueue.push({runTime:funcRunTime,func,interval,args})
  }
}

tick = () => {
while(callStack.length > 0 || microtaskQueue.length > 0){
    if(callStack.length){
      try{
        callStack[0]()
        }catch(e){Logger.error({e},"callStackRunner")}
        callStack.shift()
      }
    if(callStack.length === 0){
      callStack.push(...microtaskQueue)
      microtaskQueue = []
    }
  }
  if(runningGenes.length > 0){
    runningGenes = runningGenes.filter(gene => {
      try{return !gene.next().done}
        catch(e){
        Logger.error({e},"runningGenes")
        return false
      }
    })
  }
  if(callStack.length === 0 && macrotaskQueue.length > 0){
    callStack.push(macrotaskQueue[0])
    macrotaskQueue.shift()
  }
  const now = api.now()
  while(timeoutQueue.length !== 0){
    if(timeoutQueue[0].runTime > now)break;
    const {runTime,func,interval,args} = timeoutQueue[0]
    if(interval != null){
      setInterval(func,interval,...args)
    }
    macrotaskQueue.push(() => {
      try{func()}catch(e){Logger.error({e},"setTimeout/setInterval")}
    })
    timeoutQueue.shift()
  }
let willReturn = undefined
for(const {pos,fileName,func} of callbackFuncData.tick){
  try{
    const value = func()
    if(value != null){
      if(willReturn != null && value != willReturn){
        Logger.debug({firstValue:willReturn,secondValue:value,callback:"tick"},`two return value.willReturn ${firstValue}`)
        }
      willReturn = value
      }
    }
  catch(e){
    Logger.error({e,pos,fileName,funcName,func,callbackName:"tick"},"in callback")
    }
  }
return willReturn
}

const getCodeBlockInfo = (text) => {
  const firstText = text.match(/(?<=global::import).+/g) ?? []
  const secondText = firstText.map(str => {
    const rawFrom = str.match(/(?<=from\s+).+/)[0].trim()
    return {
      from: rawFrom[0] === "[" ? JSON.parse(rawFrom) : rawFrom,
      importType: str.match(/^.+(?=from)/)[0].trim()
    }
  })
  const fileNameMatch = text.match(/(?<=global::filename\s+).+/)
  const fileName = fileNameMatch ? fileNameMatch[0].trim() : "unknown"
  return {fileName, importData: secondText}
}

const load = (pos) => {
  return readCodeBlock(pos)
    .then(text => {
      if(!text){
        Logger.warn({pos},"text is undefined/null.end load this block")
        return;
      }
      const {fileName,importData} = getCodeBlockInfo(text)
      let importTypeData = []
      let importDataByGlobal = []
      for(const {from,importType} of importData){
        const fromStr = from.toString()
        const importFileData = global.filter(({pos,fileName}) => pos === fromStr || fileName === from)
        
        if(importType[0] === "*"){
          if(/\*\s+as/.test(importType)){
            const importObj = Object.fromEntries(importFileData.map(({name,data}) => [name,data]))
            const importName = importType.match(/(?<=as\s+).+/)[0].trim()
            importTypeData.push(importName)
            importDataByGlobal.push(importObj)
          }else{
            for(const {name,data} of importFileData){
              importTypeData.push(name)
              importDataByGlobal.push(data)
            }
          }
        }else if(importType[0] === "{"){
          const importText = importType.match(/(?<=\{).+(?=\})/)[0]
          for(const str of importText.split(",").map(s => s.trim())){
            if(!str) continue;
            const importDataName = str.includes("as")?str.match(/^.+(?=as)/)[0].trim():str
            const importName = str.includes("as")?str.match(/(?<=as\s+).+/)[0].trim():str
            const data = importFileData.find(({name}) => name === importDataName)
            if(data === undefined){
              Logger.warn({pos,fileName,from,importDataName},"not found data")
            }else{
              importTypeData.push(importName)
              importDataByGlobal.push(data.data)        
            }
          }
        }else{
          const importName = importType.trim()
          const data = importFileData.find(({name}) => name === importName)
          if(data === undefined){
            Logger.warn({pos,fileName,from,importName},"not found data")
          }else{
            importTypeData.push(importName)
            importDataByGlobal.push(data.data)
          }
        }
      }
      const exportData = (name,data) => {
        global.push({pos:pos.toString(),fileName,name,data})
      }
      const addEventListener = (event,func) => {
        if(Object.hasOwn(callbackFuncData,event)){
          callbackFuncData[event].push({pos,fileName,func})
          Logger.debug({event,pos,fileName},"success add function")
          }
        else{
          Logger.warn({event,pos,fileName},"unexpected event name")
          }
        }
      try{
        (new Function(...importTypeData,"exportData","addEventListener","asyncFunction",text.replaceAll("await","yield")))(...importDataByGlobal,exportData,addEventListener,asyncFunction)
      }catch(e){
        Logger.error({e,pos,fileName},"in running loading")
      }
      Logger.debug({pos,fileName},"loaded")
    })
}

let loaded = false

const startLoad = () => {
  for(const name of useCallback)callbackFuncData[name] = [];
  for(const name of systemCallback)callbackFuncData[name] = [];
  global = []
  loaded = false
  BlockDataIO.read(codeBlockListPos)
    .then(value => {
      if(!value) return Logger.info({loadData:value},"not found load data.end load.")
      
      let promises = value.map(pos => readCodeBlock(pos).then(text => text ? [pos, getCodeBlockInfo(text)] : null))
      
      return Promise.all(promises).then(data => {
        data = data.filter(Boolean)
        let nodes = new Map()
        let graph = new Map()
        let inDegree = new Map()
        let nameToId = new Map()
        
        for(const [pos, info] of data) nameToId.set(info.fileName, pos.toString())
        
        for(const [pos, info] of data){
          const id = pos.toString()
          nodes.set(id, {pos, info})
          if(!inDegree.has(id)) inDegree.set(id, 0)
          
          for(const {from} of (info.importData || [])){
            const targetId = nameToId.get(from) ?? from.toString()
            if(!graph.has(targetId)) graph.set(targetId, [])
            graph.get(targetId).push(id)
            inDegree.set(id, (inDegree.get(id) || 0) + 1)
          }
        }
        
        let queue = []
        for(const [id, degree] of inDegree) if(degree === 0) queue.push(id)
        
        let sortedPosList = []
        while(queue.length > 0){
          const currentId = queue.shift()
          const node = nodes.get(currentId)
          if(node) sortedPosList.push(node.pos)
          for(const depId of (graph.get(currentId) || [])){
            const newDegree = inDegree.get(depId) - 1
            inDegree.set(depId, newDegree)
            if(newDegree === 0) queue.push(depId)
          }
        }
        
        if(sortedPosList.length !== data.length){
          Logger.error({total: data.length, sorted: sortedPosList.length}, "Dependency resolution failed (Circular or Missing)")
          throw new Error("Dependency error")
        }
        return sortedPosList
      })
      .then(loadCodeBlockPos => {
        Logger.info({loadCodeBlockPos},"start load!")
        return loadCodeBlockPos.reduce((promise,pos) => promise.then(() => load(pos)), Promise.resolve())
      })
    })
    .then(() => {
      loaded = true
      Logger.info({},"success loaded!!")
      if(useCallback.includes("onload")){
        Logger.debug({},"start call 'onload'")
        onload()
      }
      if(useCallback.includes("onPlayerJoin")){
        Logger.debug({},"start call 'onPlayerJoin'")
        for(const id of api.getPlayerIds()){
          queueMicrotask(() => onPlayerJoin(id))
        }
      }
    })
    .catch(e => Logger.error({e},"loading failed"))
}

var global = []

var addLoadCodeBlock = (pos) => {
  return BlockDataIO.read(codeBlockListPos).then(value => {
    value = (value??[]).filter(p => String(p) !== String(pos))
    value.push(pos)
    return BlockDataIO.write(codeBlockListPos, value)
  })
}

var deleteLoadCodeBlock = (pos) => {
  return BlockDataIO.read(codeBlockListPos).then(value => {
    const filtered = (value??[]).filter(p => String(p) !== String(pos))
    return BlockDataIO.write(codeBlockListPos, filtered)
  })
}

startLoad()
