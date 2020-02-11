import {ServersApi} from "./src";
import {JSONResult} from "./src/entity";

ServersApi.ApiAuthLogin({
  user: 'caozuogong',
  password: 'caozuogong'
}).then((res: JSONResult) => {
  if (res.success) {
    console.log(res.data);
  } else {
    console.log(res.message);
  }
});