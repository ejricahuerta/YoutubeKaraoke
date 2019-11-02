using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Karaoke.Entities;
using Karaoke.Hubs;
using Karaoke.Models;
using Karaoke.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Karaoke {
    public class Startup {

        public Startup (IConfiguration configuration) {
            this.Configuration = configuration;

        }
        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices (IServiceCollection services) {

            services.AddTransient<IYoutubeService, YoutubeService> ();
            services.AddTransient<IKaraokeService, KaraokeService> ();
            services.AddSingleton<YoutubeHub> ();

            services.AddDbContext<KaraokeContext> ();

            services.Configure<CookiePolicyOptions> (options => {
                // This lambda determines whether user consent for non-essential cookies is needed for a given request.
                options.CheckConsentNeeded = context => true;
                options.MinimumSameSitePolicy = SameSiteMode.None;
            });

            services.AddMvc ().SetCompatibilityVersion (CompatibilityVersion.Version_2_2);
            services.AddCors (options => options.AddPolicy ("CorsPolicy",
                builder => {
                    builder.AllowAnyMethod ().AllowAnyHeader ()
                        .WithOrigins ("http://localhost:5000", "http://192.168.2.166:5000", "192.168.0.23:5000")
                        .AllowCredentials ();
                }));
            services.AddSignalR ();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure (IApplicationBuilder app, IHostingEnvironment env, KaraokeContext context) {
            if (env.IsDevelopment ()) {
                app.UseDeveloperExceptionPage ();
            } else {
                app.UseExceptionHandler ("/Error");
            }

            app.UseStaticFiles ();
            app.UseCookiePolicy ();
            app.UseCors ("CorsPolicy");

            app.UseSignalR (routes => {
                routes.MapHub<YoutubeHub> ("/hub");
            });
            System.Console.WriteLine ($"SONG COUNT: {context.Songs.Count()}");
            var songsToRemove = new List<Song> ();
            var songsUpdated = new List<Song> ();
            var listofWords = new List<string> {
                "&quot;",
                "(",
                ")",
                "Guitar",
                "HD",
                "Karaoke",
                "lyrics",
                "Instrumental",
                "Version",
                "Female key",
                "Coversph",
                "]",
                "[",
                "Acoustic",
                "/",
                "|",
                "OST"

            };
            RegexOptions options = RegexOptions.None;
            Regex regex = new Regex ("[ ]{2,}", options);
            foreach (var song in context.Songs.Include (p => p.SongId).Include (p => p.Snippet)) {
                if (string.IsNullOrEmpty (song.SongId.VideoId.Trim ())) {
                    songsToRemove.Add (song);
                }
                var songTitle = song.Snippet.Title;
                foreach (var item in listofWords) {
                    songTitle = songTitle.Replace (item, string.Empty, true, CultureInfo.CurrentCulture);

                    songTitle = regex.Replace (songTitle, " ");
                    songTitle = songTitle.Replace ("-", " - ");
                    songTitle = songTitle.Replace ("&amp;", "&");
                    songTitle = songTitle.Replace ("&#39;", "'");

                }
                song.Snippet.Title = songTitle;
                songsUpdated.Add (song);

            }
            context.Songs.RemoveRange (songsToRemove);
            context.Songs.UpdateRange (songsUpdated);
            context.SaveChanges ();
            app.UseMvc ();
        }
    }
}