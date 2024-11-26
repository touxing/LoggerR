declare module 'web-worker:*' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
declare module "rollup-plugin-web-worker-loader"
