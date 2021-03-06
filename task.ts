import fetch, {Response} from 'node-fetch';
import * as fs from "fs";
import * as path from 'path';

export interface GenerateRestfulApiProps {
  baseUrl: string;
}

interface ResponseData {
  basePath: string;
  definitions: ResponseDataDefinitions;
  host: string;
  info: ResponseDataInfo;
  paths: ResponseDataDefinitions;
  swagger: string;
  tags: ResponseDataTags[];
}

interface ResponseDataDefinitions {
  [name: string]: any
}

interface ResponseDataInfo {
  description: string;
  version: string;
  title: string;
}

interface ResponseDataTags {
  name: string;
  description: string;
}

export class GenerateRestfulApi {

  private readonly baseUrl: string;

  private info!: ResponseDataInfo;

  private path!: ResponseDataDefinitions;

  private definitions!: ResponseDataDefinitions;

  private readonly types: any;

  private api!: any[];

  constructor(props: GenerateRestfulApiProps) {
    this.baseUrl = props.baseUrl;
    this.types = {
      'string': 'string',
      'integer': 'number',
      'int': 'number',
      'array': 'any[]',
      'object': 'any',
      'boolean': 'boolean',
      'file': 'any'
    }
  }

  public taskStart() {
    return new Promise(async (resolve, reject) => {
      fetch(this.baseUrl).then((res: Response) => res.json()).then((json: ResponseData) => {
        [this.info, this.path, this.definitions] = [json.info, json.paths, json.definitions];
        this.genEntity();
        this.genDto();
        this.genApi();
        resolve()
      }).catch(e => {
        reject(e);
      });
    })
  }

  /**
   * 生生实体类
   * dts.d.ts
   */
  private genEntity() {
    const def: any[] = [];
    Object.keys(this.definitions).forEach((v: any) => {
      def.push({
        name: this.definitions[v].title.replace(/[«»]/g, ''),
        value: this.definitions[v].properties
      })
    });
    let list: string = '';
    def.forEach((k: any) => {
      let attr: string = '';
      let flag = false;
      k.value && Object.keys(k.value).forEach(s => {
        if (k.value[s].type === 'object') {
          flag = true;
          attr += `  ${s}?: T;\n`
        } else if (k.value[s].type === 'array') {
          if (k.value[s].items.type) {
            attr += `  ${s}?: ${this.types[k.value[s].type] || k.value[s].type};\n`
          } else {
            const ref = (k.value[s].items.$ref as string).split('/');
            attr += `  ${s}?: ${ref[ref.length - 1]}[];\n`
          }
        } else if (k.value[s].type) {
          attr += `  ${s}?: ${this.types[k.value[s].type] || k.value[s].type};\n`
        } else {
          const ref = (k.value[s].$ref as string).split('/');
          attr += `  ${s}?: ${ref[ref.length - 1]};\n`
        }
      });
      list += `export interface ${k.name} ${flag ? '<T = any>' : ''}{
${attr}}\n\n`
    });
    fs.writeFileSync(path.join(__dirname, 'lib/entity.ts'), list);
  }

  /**
   * 生成调用方法参数dto
   * dts.d.ts
   */
  private genDto() {
    const def: any[] = [];
    Object.keys(this.path).forEach((v: any) => {
      Object.keys(this.path[v]).forEach((s: any) => {
        const rs = this.path[v][s].responses['200'].schema['$ref'];
        if (!!rs) {
          def.push({
            methods: s,
            path: v,
            parameters: this.path[v][s].parameters,
            operationId: this.path[v][s].operationId
              .replace(/([a-z])/, (_a: string, b: string) => b.toLocaleUpperCase())
              .replace(/_/, ''),
            responses200: rs,
            summary: this.path[v][s].summary,
            description: this.path[v][s].description,
          })
        }
      });
    });

    let list: string = '';
    this.api = def;
    def.forEach((k: any) => {
      let attr: string = '';
      // console.log(typeof k.parameters);
      (k.parameters || []).forEach((s: any) => {
        attr += `  ${s.name}${s.required ? '?' : ''}: ${this.types[s.type] || s.type};\n`
      });
      if (['get', 'header'].indexOf(k.methods) >= 0) {
        list += `export interface ${k.operationId
          } {
${attr}}\n\n`
      }
    });
    fs.writeFileSync(path.join(__dirname, 'lib/dto.ts'), list);
  }

  /**
   * 生成api
   * dts.d.ts
   */
  private genApi() {
    let list: string = '';
    let entity: string[] = [];
    let dto: string[] = [];

    this.api.forEach((k: any) => {
      let params = '';
      let postParam = '';
      if (['get', 'header'].indexOf(k.methods) >= 0) {
        params = 'query';
        postParam = k.operationId;
        dto.push(postParam);
      } else {
        params = 'body';
        if (k.parameters && k.parameters[0].schema) {
          const p = (k.parameters[0].schema['$ref'] as string).split('/');
          postParam = p[p.length - 1];
          entity.push(postParam)
        } else {
          let queryParam: any[] = [];
          k.parameters.forEach((v: any) => {
            if (v.name !== 'token') {
              queryParam.push(`${v.name}?: ${this.types[v.type]}`);
            }
          });
          postParam = `{${queryParam.join(', ')}}`;
        }
      }
      const ref = (k.responses200 as string).split('/');
      let rt = `<${ref[ref.length - 1].replace(/«/g, '<').replace(/»/g, '>')}>`;
      if (/<List/.test(rt)) {
        rt = rt.replace(/List<(\w+)>/, (a: string, b: string) => {
          entity.push(b);
          return b + '[]'
        });
      } else {
        const rtSp = rt.split('<');
        rtSp.filter(v => !!v).forEach(v => {
          entity.push(v.replace(/>/g, ''))
        });
      }
      list += `  /**
   * ${k.summary}
   * ${k.description}
   */
  static ${k.path
        .replace(/\/([a-z])/g, (_a: any, b: string) => b.toLocaleUpperCase())
        .replace(/\/({\w+})/g, '')
        .replace(/_([a-z])/g, (_a: any, b: string) => b.toLocaleUpperCase())
        .replace(/\//g, '')
        }(${params}: ${postParam}): Promise${rt}{
    return services.connection('${k.methods}', '${k.path}', ${params})\n  }\n\n`
    });

    let obj: any = {};
    entity.forEach((v: string) => {
      if (['any', 'object'].indexOf(v) < 0) obj[v] = 1;
    });
    entity = Object.keys(obj);

    const className = `// @ts-ignore
import services from '../../server'
import {${entity.join(',\n    ')} \n} from "./entity"\n
import {${dto.join(',\n    ')} \n} from "./dto"
\n
/**
 * ${this.info.title}
 * ${this.info.description}
 * ${new Date()}
 */
export class ServersApi {\n${list}}\n`;
    fs.writeFileSync(path.join(__dirname, 'lib/index.ts'), className);
  }
}
