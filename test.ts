import {ServersApi} from "./dist/js";
import {JSONResult} from "./dist/js/entity";

ServersApi.OAN0001A02({
  id: 1,
  token: 'caozuogong'
}).then((res: JSONResult) => {
  if (res.success) {
    console.log(res.data);
  } else {
    console.log(res.message);
  }
});
