using System;
using System.Collections.Generic;
using System.Linq;
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
            Configuration = configuration;
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
            var songsToRemove = new List<Song>();
            foreach (var song in context.Songs.Include(p=>p.SongId))
            {
                if(string.IsNullOrEmpty(song.SongId.VideoId.Trim())){
                    songsToRemove.Add(song);
                }
            }
            context.Songs.RemoveRange(songsToRemove);
            context.SaveChanges();
                        app.UseMvc ();
        }
    }
}