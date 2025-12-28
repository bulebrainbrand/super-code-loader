# super code loader system
```scl sys```
async/await、promise,import/exportとそれに伴う読み込み順序の決定、ファイル名、コールスタック、microtaskQueue,macrotaskQueue,定期的に実行されるジェネレーター関数、モダンなLogger、callbackの返り値管理とエラーハンドリング、setTimeout/setIntervalが使えます
## global::
### global::import
```js
//global::import a from [0,0,0]
//global::import {b,c} from c
//global::import * as a from d
//global::import * from [100,100,5]
```
コードローダーによる読み込み時にこれらを適切な形でスコープ内変数として宣言されます(挙動は標準的なimportと同じはず)

コードブロックを押したときはimportされません

fromにunknownを使わないでください
### global::filename
```js
//global::filename foo
```
自身のコードブロックのファイルネームを指定し、importやエラー表示時に使われます。必須ではありません。ない場合は"unknown"となります。
## exportData
```js
exportData("a",() => {console.log(1)})
```
#1が名前、#2がデータです。

クロージャーによって自動的に座標とファイル名が添付されてexportされます

exportしたデータは可変なので、objectで変更を禁止したい場合はFreeze等をしてください

## async/await
```js
asyncFunction(function* (arg1){
await new Promise((resolve) => setTimeout(() => resolve(),500))
api.log(arg1)
})
```
awaitのときの返り値がPromiseでないとき(setTimeout単体)のとき、思う動作にならないことがあります。promiseでラップしてください。

ジェネレーター関数として宣言して、それをそのまま渡してください

内部的には,awaitをyieldに置き換えているだけです。なので、awaitをyieldとして書いても動きます

## Logger
code.jsの先頭を見ればわかりますが、Loggerは
5種類あります。
### error(obj,text)
エラーを意味します。obj内にErrorのインスタンスがあれば、それを使ってエラーメッセージとスタックを表示します
### warn,info,debug
それぞれ第1引数にobj,第2引数に文字列を期待します
### assert
falseの時だけエラーとしてログを表示します。🫖はtestのtつながりです
## ロードするブロックの設定
### deleteLoadCodeBlock
第1引数にposを取ります。
Promiseを返します。
### addLoadCodeBlock
第1引数にposを取ります。
Promiseを返します。
## BlockDataIO
```js
//global::import BlockDataIO from BlockDataIO
BlockDataIO.read(pos)
BlockDataIO.write(pos,any)
```
## callback管理
### useCallback
callback管理システムに組み込まれるcallback関数の名前の配列です。bloxdにないものでも可。
### addEventListener
callbackの呼び出し時に処理される関数を追加できる関数です。
```js
/**
* @param {string} callbackName - useCallbackにあるcallback名
* @param {function} - callbackの呼び出し時に呼ばれる関数
* @returns {void}
*/
addEventListener(callbackName,function)
```
### 返値の管理
callbackに登録された関数からundefined以外の返り値を受け取ったときは、```[[willReturn]]```要素に保存されます。willReturnがundefinedでないときにwillReturnを変更しようとしたら、失敗します。つまり、先に実行された関数のほうが優先されます。2回目以降の返り値はLogger.warnでの警告ログが表示されます。読み込み順序は決定論的ですが、コードブロックの読み込みの追加順序にも依存するので、複数の返り値を複数の関数で返す予定なら、一つのコードブロックに統合して同じ関数にまとめる方が得策かもしれません
