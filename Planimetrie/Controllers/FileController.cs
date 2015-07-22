using System;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Web;
using System.Web.Http;

namespace Planimetrie
{
    public class FileController : ApiController
    {
        [HttpGet]
        public HttpResponseMessage Get(string mode, string file)
        {
            var root = HttpContext.Current.Server.MapPath("~/App_Data/Planimetria");
            var path = Path.Combine(root, file);

            var response = new HttpResponseMessage(HttpStatusCode.OK);

            var stream = new FileStream(path, FileMode.Open);
            response.Content = new StreamContent(stream);

            response.Content.Headers.ContentType = new MediaTypeHeaderValue("image/bmp");
            response.Content.Headers.ContentDisposition = new ContentDispositionHeaderValue("attachment");
            response.Content.Headers.ContentDisposition.FileName = Path.GetFileName(file);

            return response;
        }

        public HttpResponseMessage Post()
        {
            if (!Request.Content.IsMimeMultipartContent())
            {
                throw new HttpResponseException(HttpStatusCode.UnsupportedMediaType);
            }

            try
            {
                if (HttpContext.Current.Request.Files.AllKeys.Length > 0)
                {
                    var httpPostedFile = HttpContext.Current.Request.Files["userfile"];
                    if (httpPostedFile != null)
                    {
                        string root = Path.Combine(HttpContext.Current.Server.MapPath("~/App_Data/Planimetria"), DateTime.Now.Ticks.ToString());
                        Directory.CreateDirectory(root);
                        var fileSavePath = Path.Combine(root, httpPostedFile.FileName);
                        httpPostedFile.SaveAs(fileSavePath);

                        var urls = PdfImageExtractor.ExtractImages(fileSavePath);

                        HttpContext.Current.Response.ContentType = "text/html";
                        if (urls.Count > 0)
                            HttpContext.Current.Response.Write("[\"" + string.Join("\",\"", urls.ToArray()) + "\"]");
                        HttpContext.Current.Response.End();
                    }
                }

                return Request.CreateResponse(HttpStatusCode.OK);
            }
            catch (System.Exception e)
            {
                return Request.CreateErrorResponse(HttpStatusCode.InternalServerError, e);
            }
        }

        [Route("api/export")]
        public HttpResponseMessage Export()
        {
            var consistenze = HttpContext.Current.Request.Form["consistenze"];
            MemoryStream stream = new MemoryStream();
            StreamWriter writer = new StreamWriter(stream);

            writer.WriteLine("PIANO,DESTINAZIONE,USO,NOTE,SUPERFICIE,COEFF.RAGGUAGLIO,SUP. RAGGUAGLIATA");

            if (!string.IsNullOrEmpty(consistenze))
            {
                dynamic cons = Newtonsoft.Json.JsonConvert.DeserializeObject(consistenze);
                for (int i = 0; i < cons.Count; i++)
                {
                    var consistenza = cons[i];
                    writer.WriteLine(string.Format("{0},{1},{2},{3},{4},{5},{6}",
                        consistenza.piano == null ? string.Empty : consistenza.piano.ToString(),
                        consistenza.destinazione.nome.ToString(),
                        consistenza.uso.ToString(),
                        consistenza.note == null ? string.Empty : consistenza.note.ToString(),
                        ((double)consistenza.area).ToString(CultureInfo.InvariantCulture),
                        ((double)consistenza.coeff).ToString(CultureInfo.InvariantCulture),
                        ((double)consistenza.areaRagguagliata).ToString(CultureInfo.InvariantCulture)
                    ));
                }
            }

            writer.Flush();
            stream.Position = 0;

            HttpResponseMessage result = new HttpResponseMessage(HttpStatusCode.OK);
            result.Content = new StreamContent(stream);
            result.Content.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
            result.Content.Headers.ContentDisposition = new ContentDispositionHeaderValue("attachment") { FileName = "Export.csv" };

            return result;
        }
    }

}

