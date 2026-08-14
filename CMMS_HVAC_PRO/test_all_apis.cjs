var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// test_all_apis.ts
var http = __toESM(require("http"), 1);
var tables = ["activos", "usuarios", "mantenimientos", "tickets", "informes", "eventos", "clientes", "sucursales"];
async function testAll() {
  for (const table of tables) {
    await new Promise((resolve) => {
      http.get(`http://localhost:3000/api/sync/${table}?since=0`, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          console.log(`Table: ${table} | Status: ${res.statusCode} | Data size: ${data.length}`);
          if (res.statusCode !== 200) console.log("Response:", data);
          resolve(null);
        });
      }).on("error", (err) => {
        console.log(`Table: ${table} | Error: ${err.message}`);
        resolve(null);
      });
    });
  }
}
testAll();
