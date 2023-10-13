import net from "node:net";
import { Stream } from "node:stream";

const STATUS_CODES = {
  200: "OK",
};
const CRLF = "\r\n";

class ServerResponse extends Stream {
  constructor(req) {
    super();
    this.socket = req.socket;
    this.statusCode = 200;
    this.on("finish", () => {
      this.socket.end();
    });
  }
  send(data) {
    let header = `HTTP/1.1 ${this.statusCode} ${
      STATUS_CODES[this.statusCode]
    }${CRLF}`;
    header += `Date: ${new Date().toUTCString()} ${CRLF}`;
    header += `Content-Length: ${Buffer.byteLength(data)}${CRLF}`;
    header += CRLF;
    return this.socket.write(`${header}${data}`);
  }
  end(data) {
    this.send(data);
    this.emit("finish");
  }
}

class IncomingMessage extends Stream.Readable {
  constructor(socket) {
    super();
    this.socket = socket;
    this.headers = [];
    this.method = "";
    this.url = "";
    this.version = "";
  }
}

class Parser {
  constructor(socket) {
    this.socket = socket;
    this.headerMessage = "";
  }
  parse() {
    this.socket.on("data", (chunk) => {
      this.headerMessage += chunk;
      if (this.headerMessage.endsWith("\r\n\r\n")) {
        this.parseData();
      }
    });
  }
  parseData() {
    const rows = this.headerMessage.split("\r\n");
    const [muv, ...row] = rows;
    const [method, url, version] = muv.split(" ");
    const removeEmpryRow = row.filter((item) => item !== "");
    const headers = this.getKeyAndValue(removeEmpryRow);
    const req = new IncomingMessage(this.socket);
    req.headers = headers;
    req.method = method;
    req.url = url;
    req.version = version;
    this.headerMessage = "";
    return this.onInComing(req);
  }
  getKeyAndValue(arr) {
    const res = [];
    arr.forEach((item) => {
      res.push(item.split(" "));
    });
    return res;
  }
}

class HTTPServer extends net.Server {
  constructor(fn) {
    super();
    this.on("request", fn);
    this.on("connection", (socket) => {
      this.connect(socket);
    });
  }
  onInComing(req) {
    const res = new ServerResponse(req);
    this.emit("request", req, res);
  }
  connect(socket) {
    const httpParser = new Parser(socket);
    httpParser.onInComing = this.onInComing.bind(this);
    httpParser.parse(socket);
  }
}

function createServer(fn) {
  return new HTTPServer(fn);
}

class Application {
  constructor() {
    this.routes = new Map();
    this.server = createServer(this.handleRequest.bind(this));
  }
  use(path, handler) {
    if (typeof path === "function") {
      handler = path;
      path = "/";
    }
    const route = this.routes.get(path);
    if (!route) {
      this.routes.set(path, [handler]);
    } else {
      route.push(handler);
    }
  }
  handle(req, res, fns) {
    let id = 0;
    const next = () => {
      if (id < fns.length) {
        fns[id++](req, res, next);
      }
    };
    next();
  }
  handleRequest(req, res) {
    if (this.routes.has(req.url)) {
      const fns = this.routes.get(req.url);
      this.handle(req, res, fns);
    }
  }
  listen(port, cb) {
    this.server.listen(port, cb);
  }
}

function express() {
  return new Application();
}

const app = express();

const fn1 = (req, res, next) => {
  console.log("middleware1 start");
  next();
  console.log("middleware1 end");
};
const fn2 = (req, res, next) => {
  console.log("middleware2 start");
  res.end("main");
  next();
  console.log("middleware2 end");
};

const fn3 = (req, res, next) => {
  console.log("middleware3 start");
  res.end("api");
  next();
  console.log("middleware3 end");
};

const fn5 = (req, res, next) => {
  console.log("middleware5 start");
  res.end("test");
  next();
  console.log("middleware5 end");
};

app.use(fn1);
app.use(fn2);
app.use("/api", fn3);
app.use("/test", fn5);

app.listen(8000, () => {
  console.log("App is listen at localhost:3000");
});
