import {Gulpclass, Task} from 'gulpclass/Decorators'
import * as gulp from 'gulp'
import {GenerateRestfulApi} from "./task";

const ts = require('gulp-typescript');


@Gulpclass()
export class Gulpfile {

  @Task()
  generateBuild() {
    return gulp.src([
      'lib/index.ts',
      'lib/dto.ts',
      'lib/entity.ts',
    ]).pipe(ts({
      declaration: true,
      'target': 'es5',
      rootDir: __dirname,
      'types': [
        'node'
      ],
      lib: ['es2017', 'dom'],
      'noResolve': false
    })).pipe(gulp.dest((file: any) => {
      return 'dist/js'
    }))
  }

  @Task()
  async generateFetch() {
    return Promise.all([
      new GenerateRestfulApi({baseUrl: 'http://localhost:8080/v2/api-docs'}).taskStart(),
    ]).catch((err) => {
      console.log("连接服务器出错", err);
    });
  }
}
