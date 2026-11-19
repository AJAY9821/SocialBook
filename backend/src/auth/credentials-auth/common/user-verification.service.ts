import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { VerificationToken } from 'models/auth';
import { User } from 'models/user';
import { Model } from 'mongoose';
import { EmailService } from 'src/common/services/email.service';
import { CustomLogger } from 'src/common/services/logger.service';
import { v4 as uuidv4 } from 'uuid';
import { ResendVerificationEmailResDTO } from '../credentials-auth-dto/resendVerificationEmail-res.dto';
import { CustomConfigService } from 'src/common/services';
import { Request } from 'express';
import * as argon2 from 'argon2';
import {
  forgotPassReqDTO,
  ResetPassReqDTO,
  ResetPassResDTO,
  forgotPassResDTO,
} from './user-verification-dto';
import { isEmail } from 'validator';

@Injectable()
export class UserVerificationService {
  constructor(
    @InjectModel(VerificationToken.name)
    private readonly VerificationTokenModel: Model<VerificationToken>,

    @InjectModel(User.name)
    private readonly UserModel: Model<User>,

    private readonly logger: CustomLogger,
    private readonly emailService: EmailService,
  ) {
    this.logger.setContext('UserVerification');
  }

  // -------------------------------------------------------------------------------------------------

  private async generateVerificationToken(
    user: User,
  ): Promise<VerificationToken> {
    const registartionToken: string = uuidv4();

    // Exactly 1 minute (60 seconds = 60,000 milliseconds)
    const ONE_MINUTE_MS = 60 * 1000;

    const tokenObj: VerificationToken =
      await this.VerificationTokenModel.create({
        userId: user._id.toString(),
        token: registartionToken,
        expiry: new Date(Date.now() + ONE_MINUTE_MS),
      });

    return tokenObj;
  }

  async sendVerificationEmail(user: User, req: Request): Promise<void> {
    try {
      const newVerificationToken = await this.generateVerificationToken(user);

      const { subject, emailBody, fromEmail, EmailVerificationTemplate } =
        CustomConfigService.PROPERTIES.accountVerificationEmail;

      if (newVerificationToken != null) {
        const serverUrl = `${req.protocol}://${req.get('host')}`;

        const verificationLink = `${serverUrl}/api/verify_user/${newVerificationToken.token}`;

        const data = { link: verificationLink };

        const html = EmailVerificationTemplate.replace(
          '$$email',
          user.name || user.email || 'user',
        )
          .replace('$$data.link', data.link)
          .replace('$$timeLeftMessage', '24 Hours')
          .replace(
            '$$message',
            `Thank you for signing up for <strong>M_Studio</strong>. <br />
          Please click the button below to verify your email address and
          securely log in.`,
          );

        console.log({ data });

        await this.emailService.sendTextMail({
          fromEmail,
          toEmail: user.email,
          subject,
          textBody: emailBody,
          html,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async resendVerificationEmail(
    user: User,
    req: Request,
  ): Promise<ResendVerificationEmailResDTO> {
    if (user.isEmailVerified) {
      return {
        error: false,
        statusCode: HttpStatus.OK,
        msg: 'Account already verified',
      };
    }

    const userVerificationToken = await this.VerificationTokenModel.findOne({
      userId: user.id,
      isExpired: false,
    });

    if (userVerificationToken && userVerificationToken.expiry >= new Date()) {
      await this.VerificationTokenModel.findOneAndUpdate(
        {
          userId: user.id,
          isExpired: false,
        },
        {
          isExpired: true,
        },
      );
    }

    await this.sendVerificationEmail(user, req);

    return {
      error: false,
      statusCode: HttpStatus.OK,
      msg: 'Verification OTP re-sent successfully!',
    };
  }

  // -------------------------------------------------------------------------------------------------

  async validateVerificationToken(token: string) {
    try {
      const userVerificationToken = await this.VerificationTokenModel.findOne({
        token,
        isExpired: false,
      });

      if (!userVerificationToken) {
        throw new BadRequestException('Token not found !!');
      }

      if (userVerificationToken && userVerificationToken.expiry >= new Date()) {
        await this.VerificationTokenModel.findOneAndUpdate(
          {
            token,
            isExpired: false,
          },
          {
            isExpired: true,
          },
        );

        await this.UserModel.findByIdAndUpdate(
          userVerificationToken.userId.toString(),
          {
            isEmailVerified: true,
            isActive: true,
          },
          {
            runValidators: true,
            new: true,
          },
        );

        return true;
      } else {
        return false;
      }
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  async sendForgotPassEmail(
    forgotPassData: forgotPassReqDTO,
    req: Request,
  ): Promise<forgotPassResDTO> {
    const { email } = forgotPassData;

    try {
      const user = await this.UserModel.findOne({ email });

      if (!user) {
        throw new BadRequestException('User does not exist');
      }

      // Check if the user already has a valid token and expire it
      const existingToken = await this.VerificationTokenModel.findOne({
        userId: user.id,
        isExpired: false,
      });

      if (existingToken) {
        await this.VerificationTokenModel.findOneAndUpdate(
          { userId: user.id, isExpired: false },
          { isExpired: true },
        );
      }

      // Generate a new verification token
      const newVerificationToken = await this.generateVerificationToken(user);

      const frontendUrl =
        process.env.FRONTEND_URL || 'http://localhost:5173';
      const forgotPassLink = `${frontendUrl}/reset-password?token=${newVerificationToken.token}`;

      this.logger.log(`Password reset link generated for ${user.email}: ${forgotPassLink}`);

      // If AWS SES credentials exist, attempt to send real email
      if (
        process.env.AWS_SES_ACCESS_KEY_ID &&
        process.env.AWS_SES_SECRET_ACCESS_KEY
      ) {
        try {
          const { subject, emailBody, fromEmail, ForgotPasswordTemplate } =
            CustomConfigService.PROPERTIES.forgotPasswordEmail;

          const html = ForgotPasswordTemplate.replace(
            '$$email',
            user.name || user.email,
          )
            .replace('$$data.link', forgotPassLink)
            .replace('$$timeLeftMessage', '1 Minute');

          await this.emailService.sendTextMail({
            fromEmail,
            toEmail: user.email,
            subject,
            textBody: emailBody,
            html,
          });
        } catch (emailErr) {
          this.logger.warn(
            `AWS SES email delivery failed (${emailErr?.message}). Using local link fallback.`,
          );
        }
      }

      return {
        error: false,
        statusCode: HttpStatus.OK,
        msg: 'Password reset link generated successfully!',
        resetToken: newVerificationToken.token,
        resetLink: forgotPassLink,
      };
    } catch (error) {
      throw error;
    }
  }

  async resetPassword(newUserData: ResetPassReqDTO): Promise<ResetPassResDTO> {
    try {
      const userVerificationToken = await this.VerificationTokenModel.findOne({
        token: newUserData.token,
        isExpired: false,
      });

      if (!userVerificationToken) {
        throw new BadRequestException('Invalid or expired password reset token.');
      }

      if (userVerificationToken.expiry < new Date()) {
        userVerificationToken.isExpired = true;
        await userVerificationToken.save();
        throw new BadRequestException('Password reset token has expired. Please request a new one.');
      }

      const user = await this.UserModel.findById(userVerificationToken.userId);

      if (!user) {
        throw new BadRequestException('User account not found.');
      }

      const hashedPassword = await argon2.hash(newUserData.newPass);

      await this.UserModel.findByIdAndUpdate(
        user._id.toString(),
        {
          password: hashedPassword,
        },
        { runValidators: true, new: true },
      );

      // Expire the verification token so it cannot be used twice
      userVerificationToken.isExpired = true;
      await userVerificationToken.save();

      return {
        error: false,
        statusCode: HttpStatus.OK,
        msg: 'Your password has been reset successfully. You can now log in with your new password.',
      };
    } catch (error) {
      throw error;
    }
  }

  async validateForgotPassToken(token: string) {
    try {
      const userVerificationToken = await this.VerificationTokenModel.findOne({
        token,
        isExpired: false,
      });

      if (!userVerificationToken) {
        throw new BadRequestException('Token not found !!');
      }

      if (userVerificationToken && userVerificationToken.expiry >= new Date()) {
        await this.VerificationTokenModel.findOneAndUpdate(
          {
            token,
            isExpired: false,
          },
          {
            isExpired: true,
          },
        );

        return true;
      } else {
        return false;
      }
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }
}
